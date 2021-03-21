// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./interfaces/IPriceFeeder.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IPmm.sol";
import "./TokenFactory.sol";
import "./utility/DODOMath.sol";

/**
 * @title PMM contract (inspired by DODOEx)
 */

contract Pmm is Lockable, Whitelist, IPmm {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    enum RStatus {ONE, ABOVE_ONE, BELOW_ONE}
    
    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Base ERC20 token 
    IERC20 public override baseToken;
    // Quote ERC20 token 
    IERC20 public override quoteToken;
    // Share tokens created by this contract.
    IExpandedIERC20 public override baseCapitalToken;
    IExpandedIERC20 public override quoteCapitalToken;
    // Variables for PMM Algorithm
    uint256 public k;
    RStatus public rStatus; // reverse status of K
    uint256 public targetBaseTokenAmount;
    uint256 public targetQuoteTokenAmount;
    uint256 public baseBalance;
    uint256 public quoteBalance;

    uint256 constant ONE = 1000000000000000000;

    event CreatedPMM();

    event Deposit(
        address indexed payer,
        address indexed receiver,
        bool isBaseToken,
        uint256 amount,
        uint256 lpTokenAmount
    );

    event Withdraw(
        address indexed payer,
        address indexed receiver,
        bool isBaseToken,
        uint256 amount,
        uint256 lpTokenAmount
    );

    event BuyBaseToken(address indexed buyer, uint256 receiveBase, uint256 payQuote);
    event SellBaseToken(address indexed seller, uint256 payBase, uint256 receiveQuote);
    
    constructor(
        address _tokenFactoryAddress,
        address _baseToken,
        address _quoteToken,
        address _priceFeeder,
        uint256 _k
    ) public nonReentrant() {
        require(address(_priceFeeder) != address(0), "Invalid PriceFeeder address");
        require(address(_quoteToken) != address(0), "Invalid QuoteToken address");
        require(address(_baseToken) != address(0), "Invalid BaseToken address");

        priceFeeder = IPriceFeeder(_priceFeeder);
        baseToken = IERC20(_baseToken);
        quoteToken = IERC20(_quoteToken);

        // Setup LP tokens
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        baseCapitalToken = tf.createToken("BASE_TLP", "TLP", 18);
        quoteCapitalToken = tf.createToken("QUOTE_TLP", "TLP", 18);

        k = _k;
        rStatus = RStatus.ONE;

        addAddress(msg.sender);
        emit CreatedPMM();

        _valiateParameters();
    }

    // Deposit base token
    function depositBase(uint256 amount) external returns (uint256) {
        return depositBaseTo(msg.sender, amount);
    }

    // Deposit quote token
    function depositQuote(uint256 amount) external returns (uint256) {
        return depositQuoteTo(msg.sender, amount);
    }

    // Withdraw base token
    function withdrawBase(uint256 amount) external returns (uint256) {
        return withdrawBaseTo(msg.sender, amount);
    }

    // Withdraw quote token
    function withdrawQuote(uint256 amount) external returns (uint256) {
        return withdrawQuoteTo(msg.sender, amount);
    }

    // Total supply of baseCapitalToken  
    function getTotalBaseCapital() public view returns (uint256) {
        return baseCapitalToken.totalSupply();
    }

    // Retreive base capital token balance of the given address
    function getBaseCapitalBalanceOf(address lp) public view returns (uint256) {
        return baseCapitalToken.balanceOf(lp);
    }

    // Retreive quote capital token balance of the given address
    function getQuoteCapitalBalanceOf(address lp) public view returns (uint256) {
        return quoteCapitalToken.balanceOf(lp);
    }

    // Total supply of quoteCapitalToken
    function getTotalQuoteCapital() public view returns (uint256) {
        return quoteCapitalToken.totalSupply();
    }

    function depositQuoteTo(address to, uint256 amount)
        public
        nonReentrant()
        returns (uint256)
    {
        (, uint256 quoteTarget) = getExpectedTarget();
        uint256 totalQuoteCapital = getTotalQuoteCapital();
        uint256 capital = amount;
        if (totalQuoteCapital == 0) {
            // give remaining quote token to lp as a gift
            capital = amount.add(quoteTarget);
        } else if (quoteTarget > 0) {
            capital = amount.wmul(totalQuoteCapital).wdiv(quoteTarget);
        }

        // settlement
        _quoteTokenTransferIn(msg.sender, amount);
        _mintQuoteCapital(to, capital);
        targetQuoteTokenAmount = targetQuoteTokenAmount.add(amount);

        emit Deposit(msg.sender, to, false, amount, capital);
        return capital;
    }

    function depositBaseTo(address to, uint256 amount)
        public
        nonReentrant()
        returns (uint256)
    {
        (uint256 baseTarget, ) = getExpectedTarget();
        uint256 totalBaseCapital = getTotalBaseCapital();
        uint256 capital = amount;
        if (totalBaseCapital == 0) {
            // give remaining base token to lp as a gift
            capital = amount.add(baseTarget);
        } else if (baseTarget > 0) {
            capital = amount.wmul(totalBaseCapital).wdiv(baseTarget);
        }

        // settlement
        _baseTokenTransferIn(msg.sender, amount);
        _mintBaseCapital(to, capital);
        targetBaseTokenAmount = targetBaseTokenAmount.add(amount);

        emit Deposit(msg.sender, to, true, amount, capital);
        return capital;
    }

    function withdrawQuoteTo(address to, uint256 amount)
        public
        nonReentrant()
        returns (uint256)
    {
        // calculate capital
        (, uint256 quoteTarget) = getExpectedTarget();
        uint256 totalQuoteCapital = getTotalQuoteCapital();
        require(totalQuoteCapital > 0, "NO_QUOTE_LP");

        uint256 requireQuoteCapital = amount.mul(totalQuoteCapital).div(quoteTarget);
        require(
            requireQuoteCapital <= getQuoteCapitalBalanceOf(msg.sender),
            "LP_QUOTE_CAPITAL_BALANCE_NOT_ENOUGH"
        );

        // settlement
        targetQuoteTokenAmount = targetQuoteTokenAmount.sub(amount);
        quoteCapitalToken.transferFrom(msg.sender, address(this), requireQuoteCapital);
        _burnQuoteCapital(requireQuoteCapital);
        _quoteTokenTransferOut(to, amount ); 

        emit Withdraw(msg.sender, to, false, amount , requireQuoteCapital);

        return amount;
    }

    function withdrawBaseTo(address to, uint256 amount)
        public
        nonReentrant()
        returns (uint256)
    {
        // calculate capital
        (uint256 baseTarget, ) = getExpectedTarget();
        uint256 totalBaseCapital = getTotalBaseCapital();
        require(totalBaseCapital > 0, "NO_BASE_LP");

        uint256 requireBaseCapital = amount.mul(totalBaseCapital).div(baseTarget);
        require(
            requireBaseCapital <= getBaseCapitalBalanceOf(msg.sender),
            "LP_BASE_CAPITAL_BALANCE_NOT_ENOUGH"
        );

        // settlement
        targetBaseTokenAmount = targetBaseTokenAmount.sub(amount);
        baseCapitalToken.transferFrom(msg.sender, address(this), requireBaseCapital);
        _burnBaseCapital(requireBaseCapital);
        
        _baseTokenTransferOut(to, amount);

        emit Withdraw(msg.sender, to, true, amount , requireBaseCapital);

        return amount;
    }

    // calculate quote token -> base token
    function queryBuyBaseToken(uint256 amount) external view returns (uint256 payQuote) {
        (payQuote,  , , ) = _queryBuyBaseToken(amount);
        return payQuote;
    }

    // calculate base token -> quote token
    function querySellBaseToken(uint256 amount) external view returns (uint256 receiveQuote) {
        (receiveQuote,  , , ) = _querySellBaseToken(amount);
        return receiveQuote;
    }

    // Buy base token
    function buyBaseToken(uint256 amount, uint256 maxPayQuote)
        external
        nonReentrant() 
        returns (uint256)
    {
        // query price
        (
            uint256 payQuote,
            RStatus newRStatus,
            uint256 newQuoteTarget,
            uint256 newBaseTarget
        ) = _queryBuyBaseToken(amount);
        require(payQuote <= maxPayQuote, "Exceeding maximum limit");

        // settle assets
        _baseTokenTransferOut(msg.sender, amount);
        _quoteTokenTransferIn(msg.sender, payQuote);

        // update TARGET
        if (targetQuoteTokenAmount != newQuoteTarget) {
            targetQuoteTokenAmount = newQuoteTarget;
        }
        if (targetBaseTokenAmount != newBaseTarget) {
            targetBaseTokenAmount = newBaseTarget;
        }
        if (rStatus != newRStatus) {
            rStatus = newRStatus;
        }

        emit BuyBaseToken(msg.sender, amount, payQuote);

        return payQuote;
    }

    // Sell base token
    function sellBaseToken(
        uint256 amount,
        uint256 minReceiveQuote
    ) external nonReentrant() returns (uint256) {
        // query price
        (
            uint256 receiveQuote,
            RStatus newRStatus,
            uint256 newQuoteTarget,
            uint256 newBaseTarget
        ) = _querySellBaseToken(amount);
        require(receiveQuote >= minReceiveQuote, "SELL_BASE_RECEIVE_NOT_ENOUGH");

        // settle assets
        _quoteTokenTransferOut(msg.sender, receiveQuote);
        _baseTokenTransferIn(msg.sender, amount);

        // update TARGET
        if (targetQuoteTokenAmount != newQuoteTarget) {
            targetQuoteTokenAmount = newQuoteTarget;
        }
        if (targetBaseTokenAmount != newBaseTarget) {
            targetBaseTokenAmount = newBaseTarget;
        }
        if (rStatus != newRStatus) {
            rStatus = newRStatus;
        }

        emit SellBaseToken(msg.sender, amount, receiveQuote);

        return receiveQuote;
    }

    function getMidPrice() public view returns (uint256 midPrice) {
        (uint256 baseTarget, uint256 quoteTarget) = getExpectedTarget();
        if (rStatus == RStatus.BELOW_ONE) {
            uint256 R = (quoteTarget.mul(quoteTarget).div(quoteBalance)).wdiv(quoteBalance);
            R = ONE.sub(k).add(k.wmul(R));
            return (priceFeeder.getValue()).wdiv(R);
        } else {
            uint256 R = (baseTarget.mul(baseTarget).div(baseBalance).wdiv(baseBalance));
            R = ONE.sub(k).add(k.wmul(R));
            return (priceFeeder.getValue()).wmul(R);
        }
    }

    function getExpectedTarget() public view returns (uint256 baseTarget, uint256 quoteTarget) {
        uint256 Q = quoteBalance;
        uint256 B = baseBalance;
        if (rStatus == RStatus.ONE) {
            return (targetBaseTokenAmount, targetQuoteTokenAmount);
        } else if (rStatus == RStatus.BELOW_ONE) {
            uint256 payQuoteToken = _RBelowBackToOne();
            return (targetBaseTokenAmount, Q.add(payQuoteToken));
        } else if (rStatus == RStatus.ABOVE_ONE) {
            uint256 payBaseToken = _RAboveBackToOne();
            return (B.add(payBaseToken), targetQuoteTokenAmount);
        }
    }

    // // INTERNAL FUCTIONS
    function _valiateParameters() internal view returns (uint256) {
        require(k < ONE, "K>=1");
        require(k > 0, "K=0");
    }

    function _baseTokenTransferIn(address from, uint256 amount) internal {
        baseToken.transferFrom(from, address(this), amount);
        baseBalance = baseBalance.add(amount);
    }

    function _quoteTokenTransferIn(address from, uint256 amount) internal {
        quoteToken.transferFrom(from, address(this), amount);
        quoteBalance = quoteBalance.add(amount);
    }

    function _baseTokenTransferOut(address to, uint256 amount) internal {
        baseToken.transfer(to, amount);
        baseBalance = baseBalance.sub(amount);
    }

    function _quoteTokenTransferOut(address to, uint256 amount) internal {
       quoteToken.transfer(to, amount);
       quoteBalance = quoteBalance.sub(amount);
    }

    function _mintBaseCapital(address user, uint256 amount) internal {
        baseCapitalToken.mint(user, amount);
    }

    function _mintQuoteCapital(address user, uint256 amount) internal {
        quoteCapitalToken.mint(user, amount);
    }

    function _burnBaseCapital(uint256 amount) internal {
        baseCapitalToken.burn(amount);
    }

    function _burnQuoteCapital(uint256 amount) internal {
        quoteCapitalToken.burn(amount);
    }

    function _queryBuyBaseToken(uint256 amount)
        internal
        view
        returns (
            uint256 payQuote,
            RStatus newRStatus,
            uint256 newQuoteTarget,
            uint256 newBaseTarget
        )
    {
        (newBaseTarget, newQuoteTarget) = getExpectedTarget();

        uint256 buyBaseAmount = amount;

        if (rStatus == RStatus.ONE) {
            // case 1: R=1
            payQuote = _ROneBuyBaseToken(buyBaseAmount, newBaseTarget);
            newRStatus = RStatus.ABOVE_ONE;
        } else if (rStatus == RStatus.ABOVE_ONE) {
            // case 2: R>1
            payQuote = _RAboveBuyBaseToken(buyBaseAmount, baseBalance, newBaseTarget);
            newRStatus = RStatus.ABOVE_ONE;
        } else if (rStatus == RStatus.BELOW_ONE) {
            uint256 backToOnePayQuote = newQuoteTarget.sub(quoteBalance);
            uint256 backToOneReceiveBase = baseBalance.sub(newBaseTarget);
            // case 3: R<1
            // complex case, R status may change
            if (buyBaseAmount < backToOneReceiveBase) {
                // case 3.1: R status do not change
                // no need to check payQuote because spare base token must be greater than zero
                payQuote = _RBelowBuyBaseToken(buyBaseAmount, quoteBalance, newQuoteTarget);
                newRStatus = RStatus.BELOW_ONE;
            } else if (buyBaseAmount == backToOneReceiveBase) {
                // case 3.2: R status changes to ONE
                payQuote = backToOnePayQuote;
                newRStatus = RStatus.ONE;
            } else {
                // case 3.3: R status changes to ABOVE_ONE
                payQuote = backToOnePayQuote.add(
                    _ROneBuyBaseToken(buyBaseAmount.sub(backToOneReceiveBase), newBaseTarget)
                );
                newRStatus = RStatus.ABOVE_ONE;
            }
        }

        return (payQuote, newRStatus, newQuoteTarget, newBaseTarget);
    }

    function _querySellBaseToken(uint256 amount)
        internal
        view
        returns (
            uint256 receiveQuote,
            RStatus newRStatus,
            uint256 newQuoteTarget,
            uint256 newBaseTarget
        )
    {
        (newBaseTarget, newQuoteTarget) = getExpectedTarget();

        uint256 sellBaseAmount = amount;

        if (rStatus == RStatus.ONE) {
            // case 1: R=1
            // R falls below one
            receiveQuote = _ROneSellBaseToken(sellBaseAmount, newQuoteTarget);
            newRStatus = RStatus.BELOW_ONE;
        } else if (rStatus == RStatus.ABOVE_ONE) {
            uint256 backToOnePayBase = newBaseTarget.sub(baseBalance);
            uint256 backToOneReceiveQuote = quoteBalance.sub(newQuoteTarget);
            // case 2: R>1
            // complex case, R status depends on trading amount
            if (sellBaseAmount < backToOnePayBase) {
                // case 2.1: R status do not change
                receiveQuote = _RAboveSellBaseToken(sellBaseAmount, baseBalance, newBaseTarget);
                newRStatus = RStatus.ABOVE_ONE;
                if (receiveQuote > backToOneReceiveQuote) {
                    // [Important corner case!] may enter this branch when some precision problem happens. And consequently contribute to negative spare quote amount
                    // to make sure spare quote>=0, mannually set receiveQuote=backToOneReceiveQuote
                    receiveQuote = backToOneReceiveQuote;
                }
            } else if (sellBaseAmount == backToOnePayBase) {
                // case 2.2: R status changes to ONE
                receiveQuote = backToOneReceiveQuote;
                newRStatus = RStatus.ONE;
            } else {
                // case 2.3: R status changes to BELOW_ONE
                receiveQuote = backToOneReceiveQuote.add(
                    _ROneSellBaseToken(sellBaseAmount.sub(backToOnePayBase), newQuoteTarget)
                );
                newRStatus = RStatus.BELOW_ONE;
            }
        } else {
            // _R_STATUS_ == Types.RStatus.BELOW_ONE
            // case 3: R<1
            receiveQuote = _RBelowSellBaseToken(sellBaseAmount, quoteBalance, newQuoteTarget);
            newRStatus = RStatus.BELOW_ONE;
        }

        return (receiveQuote, newRStatus, newQuoteTarget, newBaseTarget);
    }

    // DODO Pricing Model
    function _ROneSellBaseToken(uint256 _amount, uint256 _targetQuoteTokenAmount)
        internal
        view
        returns (uint256 receiveQuoteToken)
    {
        uint256 i = priceFeeder.getValue();
        uint256 Q2 = DODOMath._SolveQuadraticFunctionForTrade(
            _targetQuoteTokenAmount,
            _targetQuoteTokenAmount,
            i.wmul(_amount),
            false,
            k
        );
        // in theory Q2 <= targetQuoteTokenAmount
        // however when amount is close to 0, precision problems may cause Q2 > targetQuoteTokenAmount
        return _targetQuoteTokenAmount.sub(Q2);
    }

    function _ROneBuyBaseToken(uint256 _amount, uint256 _targetBaseTokenAmount)
        internal
        view
        returns (uint256 payQuoteToken)
    {
        require(_amount < _targetBaseTokenAmount, "DODO_BASE_BALANCE_NOT_ENOUGH");
        uint256 B2 = _targetBaseTokenAmount.sub(_amount);
        payQuoteToken = _RAboveIntegrate(_targetBaseTokenAmount, _targetBaseTokenAmount, B2);
        return payQuoteToken;
    }

    function _RBelowSellBaseToken(
        uint256 _amount,
        uint256 _quoteBalance,
        uint256 _targetQuoteAmount
    ) internal view returns (uint256 receiveQuoteToken) {
        uint256 i = priceFeeder.getValue();
        uint256 Q2 = DODOMath._SolveQuadraticFunctionForTrade(
            _targetQuoteAmount,
            _quoteBalance,
            i.wmul(_amount),
            false,
            k
        );
        return quoteBalance.sub(Q2);
    }

    function _RBelowBuyBaseToken(
        uint256 _amount,
        uint256 _quoteBalance,
        uint256 _targetQuoteAmount
    ) internal view returns (uint256 payQuoteToken) {
        // Here we don't require amount less than some value
        // Because it is limited at upper function
        // See Trader.queryBuyBaseToken
        uint256 i = priceFeeder.getValue();
        uint256 Q2 = DODOMath._SolveQuadraticFunctionForTrade(
            _targetQuoteAmount,
            _quoteBalance,
            i.wmul(_amount),
            true,
            k
        );
        return Q2.sub(_quoteBalance);
    }

    function _RBelowBackToOne() internal view returns (uint256 payQuoteToken) {
        // important: carefully design the system to make sure spareBase always greater than or equal to 0
        uint256 spareBase = baseBalance.sub(targetBaseTokenAmount);
        uint256 price = priceFeeder.getValue();
        uint256 fairAmount = spareBase.wmul(price);
        uint256 newTargetQuote = DODOMath._SolveQuadraticFunctionForTarget(
            quoteBalance,
            k,
            fairAmount
        );
        return newTargetQuote.sub(quoteBalance);
    }

    function _RAboveBuyBaseToken(
        uint256 _amount,
        uint256 _baseBalance,
        uint256 _targetBaseAmount
    ) internal view returns (uint256 payQuoteToken) {
        require(_amount < _baseBalance, "DODO_BASE_BALANCE_NOT_ENOUGH");
        uint256 B2 = _baseBalance.sub(_amount);
        return _RAboveIntegrate(_targetBaseAmount, _baseBalance, B2);
    }

    function _RAboveSellBaseToken(
        uint256 _amount,
        uint256 _baseBalance,
        uint256 _targetBaseAmount
    ) internal view returns (uint256 receiveQuoteToken) {
        // here we don't require B1 <= targetBaseAmount
        // Because it is limited at upper function
        // See Trader.querySellBaseToken
        uint256 B1 = _baseBalance.add(_amount);
        return _RAboveIntegrate(_targetBaseAmount, B1, _baseBalance);
    }

    function _RAboveBackToOne() internal view returns (uint256 payBaseToken) {
        // important: carefully design the system to make sure spareBase always greater than or equal to 0
        uint256 spareQuote = quoteBalance.sub(targetQuoteTokenAmount);
        uint256 price = priceFeeder.getValue();
        uint256 fairAmount = spareQuote.wdiv(price);
        uint256 newTargetBase = DODOMath._SolveQuadraticFunctionForTarget(
            baseBalance,
            k,
            fairAmount
        );
        return newTargetBase.sub(baseBalance);
    }

    function _RAboveIntegrate(
        uint256 B0,
        uint256 B1,
        uint256 B2
    ) internal view returns (uint256) {
        uint256 i = priceFeeder.getValue();
        return DODOMath._GeneralIntegrate(B0, B1, B2, i, k);
    }

}