// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./interfaces/IPriceFeeder.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExchangePair.sol";
import "./interfaces/IExchangeCore.sol";
import "./TokenFactory.sol";


contract ExchangePair is Lockable, Whitelist, IExchangePair {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    struct Provider {
        uint256 base;
        uint256 quote;
    }

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Exchange Core contract.
    IExchangeCore public exchangeCore;
    // Base ERC20 token 
    IERC20 public baseToken;
    // Quote ERC20 token 
    IERC20 public quoteToken;
    // Liquidity providers
    mapping(address => Provider) public providers;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    uint256 private _baseBalance;
    

    event Deposit(address indexed account, address indexed token,  uint256 indexed amount);
    event Withdraw(address indexed account, address indexed token,  uint256 indexed amount);
    event BuyBaseToken(address indexed buyer, uint256 receiveBase, uint256 payQuote);
    event SellBaseToken(address indexed seller, uint256 payBase, uint256 receiveQuote);
    
    constructor(
        address _exchangeCoreAddress,
        address _baseToken,
        address _priceFeeder
    ) public nonReentrant() {
        require(address(_exchangeCoreAddress) != address(0), "Invalid ExchangeCore address");
        require(address(_baseToken) != address(0), "Invalid BaseToken address");
        require(address(_priceFeeder) != address(0), "Invalid PriceFeeder address");
        
        exchangeCore = IExchangeCore(_exchangeCoreAddress);
        quoteToken = IERC20(exchangeCore.getQuoteToken());
        baseToken = IERC20(_baseToken);
        priceFeeder = IPriceFeeder(_priceFeeder);

        quoteToken.approve( _exchangeCoreAddress, MAX);
    }

    // get spot price
    function getMidPrice() external override view returns (uint256 midPrice) {
        return priceFeeder.getValue();
    }

    function getQuoteBalance() external override view returns (uint256) {
        return exchangeCore.getQuoteBalance();
    }

    function getBaseBalance() external override view returns (uint256) {
        return _baseBalance;
    }

    function getProviderData(address provider) public view returns (uint256, uint256) {
        return (providers[provider].base, providers[provider].quote);
    }

    // Deposit base token
    function depositBase(uint256 amount) public override {
        require(amount > 0 , "Invalid amount");
        baseToken.safeTransferFrom(msg.sender, address(this), amount);

        providers[msg.sender].base = providers[msg.sender].base.add(amount);

        _baseBalance = _baseBalance.add(amount);

        emit Deposit(msg.sender, address(baseToken), amount);
    }

    // Deposit quote token
    function depositQuote(uint256 amount) external override {
        require(amount > 0 , "Invalid amount");
        // quoteToken.transferFrom(msg.sender, address(this), amount);
        quoteToken.safeTransferFrom(msg.sender, address(exchangeCore) , amount);
        exchangeCore.deposit(amount);

        providers[msg.sender].quote = providers[msg.sender].quote.add(amount);

        emit Deposit(msg.sender, address(quoteToken), amount);
    }

    // Withdraw base token
    function withdrawBase(uint256 amount) external override {
        require(amount > 0 , "Invalid amount");
        require(providers[msg.sender].base >= amount , "You have insufficient balance");

        baseToken.safeTransfer(msg.sender, amount);

        providers[msg.sender].base = providers[msg.sender].base.sub(amount);

        _baseBalance = _baseBalance.sub(amount);

        emit Withdraw(msg.sender, address(baseToken), amount);
    }

    // Withdraw quote token
    function withdrawQuote(uint256 amount) external override {
        require(amount > 0 , "Invalid amount");
        require(providers[msg.sender].quote >= amount , "You have insufficient balance");

        exchangeCore.withdraw(amount, msg.sender);
        // quoteToken.transfer(msg.sender, amount);
        
        providers[msg.sender].quote = providers[msg.sender].quote.sub(amount);

        emit Withdraw(msg.sender, address(quoteToken), amount);
    }

    function queryBuyBaseToken(uint256 amount) external override view returns (uint256) {
        return _queryBuyBaseToken(amount);
    } 

    function querySellBaseToken(uint256 amount) external override view returns (uint256) {
        return _querySellBaseToken(amount);
    }

    function buyBaseToken(uint256 amount, uint256 maxPayQuote) override external {
        require(amount > 0 , "Invalid amount");
        require(_baseBalance >= amount , "Not enough supply on base tokens");

        uint256 tokenIn = _queryBuyBaseToken(amount);

        require(maxPayQuote >= tokenIn , "Exceeding your maxPayQuote");

        quoteToken.safeTransferFrom(msg.sender, address(exchangeCore), tokenIn);
        exchangeCore.deposit(tokenIn);

        // deducting fees
        uint256 totalFee = amount.wmul(exchangeCore.fee());
        amount = amount.sub(totalFee);

        baseToken.safeTransfer( msg.sender , amount);
        baseToken.safeTransfer(exchangeCore.devAddress(), totalFee);
        _baseBalance = _baseBalance.sub(amount);

        emit BuyBaseToken(msg.sender, amount, tokenIn);
    }

    function sellBaseToken(uint256 amount , uint256 minReceiveQuote) override external {
        require(amount > 0 , "Invalid amount");

        uint256 tokenOut = _querySellBaseToken(amount);
        uint256 totalQuote = exchangeCore.getQuoteBalance();

        require(tokenOut >= minReceiveQuote , "Not exceeding your minReceiveQuote");
        require(totalQuote >= tokenOut , "Not enough supply on quote tokens");

        baseToken.safeTransferFrom(msg.sender, address(this), amount);
        _baseBalance = _baseBalance.add(amount);

        // deducting fees
        uint256 totalFee = tokenOut.wmul(exchangeCore.fee());
        tokenOut = tokenOut.sub(totalFee);

        exchangeCore.withdraw(tokenOut, msg.sender);
        exchangeCore.withdraw(totalFee, exchangeCore.devAddress());

        emit SellBaseToken(msg.sender, amount, tokenOut);
    }

    function _queryBuyBaseToken(uint256 amount) internal view returns (uint256) {
        uint256 result = (priceFeeder.getValue()).wmul(amount);
        return result; 
    }

    function _querySellBaseToken(uint256 amount) internal view returns (uint256) {
        uint256 result = (priceFeeder.getValue()).wmul(amount);
        return result; 
    }

}
