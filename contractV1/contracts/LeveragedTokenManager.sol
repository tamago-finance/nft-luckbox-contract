// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/ISide.sol";
import "./interfaces/ILeverageSize.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/IPmm.sol";
import "./TokenFactory.sol";

contract LeveragedTokenManager is Lockable, Whitelist, ISide, ILeverageSize {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IExpandedIERC20;

    struct TokenOutstanding {
        int256 totalLongToken;
        int256 totalShortToken;
    }

    enum State {INITIAL, NORMAL, EMERGENCY, EXPIRED}

    // Contract state
    State public contractState;
    // PMM contract.
    IPmm public pmmLong;
    IPmm public pmmShort;
    // Price feeder contract.
    IPriceResolver public priceResolver;
    // Leveraged tokens created by this contract.
    IExpandedIERC20 public longToken;
    IExpandedIERC20 public shortToken;
    LeverageSize public leverage;
    // Quote Stablecoin
    IERC20 public quoteToken;
    // Keep track of short/long tokens that been issued
    TokenOutstanding public tokenOutstanding;
    // Total quote token that locked in this contract
    uint256 public totalRawCollateral;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    // Cap amount of tokens to be minted
    uint256 constant public CAPPED_AMOUNT = 50000000000000000000000; // ~50,000 DAI

    event CreatedLeverageTokens();
    event Minted(address indexed account, uint256 tokenInAmount, uint256 longTokenOutAmount, uint256 shortTokenOutAmount);
    event Redeemed(address indexed account, uint256 tokenOutAmount, uint256 longTokenInAmount, uint256 shortTokenInAmount);
    event AddedLiquidity(address indexed account, Side side, uint256 leverageTokenAmount, uint256 quoteTokenAmount);
    event BuyLeveragedToken(address indexed account, Side side, uint256 leverageTokenAmount);
    event SellLeveragedToken(address indexed account, Side side, uint256 leverageTokenAmount);

    constructor(
        string memory _name,
        string memory _symbol,
        LeverageSize _leverage,
        address _tokenFactoryAddress,
        address _priceResolverAddress,
        address _quoteTokenAddress,
        address _devAddress // admin
    ) public nonReentrant() {
        require( _tokenFactoryAddress != address(0), "Invalid TokenFactory address" );
        require( _priceResolverAddress != address(0), "Invalid PriceResolver address" );
        require( _quoteTokenAddress != address(0), "Invalid QuoteToken address" );
        
        // Setup long/short tokens
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        longToken = tf.createToken( string(abi.encodePacked(_name, " Long")), string(abi.encodePacked(_symbol, "-LONG")), 18);
        shortToken = tf.createToken( string(abi.encodePacked(_name, " Short")), string(abi.encodePacked(_symbol, "-SHORT")), 18);
 
        priceResolver = IPriceResolver(_priceResolverAddress);
        // FIXME : allow only DAI, USDT, USDC
        quoteToken = IERC20(_quoteTokenAddress);
        leverage = _leverage;

        addAddress(_devAddress);

        emit CreatedLeverageTokens();
    } 

    // Get synthetic long token address
    function getLongToken() public view returns (address)
    {
        return address(longToken);
    }

    // Get synthetic short token address
    function getShortToken() public view returns (address)
    {
        return address(shortToken);
    }

    // Get quote token address
    function getQuoteToken() public view returns (address)
    {
        return address(quoteToken);
    }

    function getCurrentPrice() public view returns (uint256)
    {
        return priceResolver.getCurrentPrice();
    }

    function estimateTokenOut(uint256 buyingAmount) public view returns (uint256, uint256) {
        require( buyingAmount > 0 , "Amount must be greater than 0" );
        (uint256 longPrice, uint256 shortPrice) = _estimateTokenOut();
        uint256 currentPrice = priceResolver.getCurrentPrice();
        return (longPrice.wmul(buyingAmount.wdiv(currentPrice)), shortPrice.wmul(buyingAmount.wdiv(currentPrice)));
    }

    function mint(uint256 buyingAmount) public nonReentrant() {
        require( buyingAmount > 0 , "Amount must be greater than 0" );
        require( CAPPED_AMOUNT >=  totalRawCollateral.add(buyingAmount), "Exceeding a capped amount"); 

        uint256 currentPrice = priceResolver.getCurrentPrice();
        uint256 tokenIn = buyingAmount.wdiv(currentPrice);

        (uint256 totalLong, uint256 totalShort) = _estimateTokenOut();
        totalLong = totalLong.wmul(tokenIn);
        totalShort = totalShort.wmul(tokenIn);

        totalRawCollateral = totalRawCollateral.add(buyingAmount);
        tokenOutstanding.totalLongToken = tokenOutstanding.totalLongToken.add(totalLong.toInt256());
        tokenOutstanding.totalShortToken = tokenOutstanding.totalShortToken.add(totalShort.toInt256());

        // Collecting synthetic assets from the user
        quoteToken.safeTransferFrom(msg.sender, address(this), buyingAmount);

        require(longToken.mint(msg.sender, totalLong), "Minting long tokens failed");
        require(shortToken.mint(msg.sender, totalShort), "Minting short tokens failed");

        emit Minted(msg.sender, tokenIn, totalLong, totalShort);
    }

    function redeem(uint256 redeemingAmount) public nonReentrant() {
        require( redeemingAmount > 0 , "Amount must be greater than 0" );

        uint256 currentPrice = priceResolver.getCurrentPrice();
        uint256 tokenOut = redeemingAmount.wdiv(currentPrice);

        (uint256 totalLong, uint256 totalShort) = _estimateTokenOut();
        totalLong = totalLong.wmul(tokenOut);
        totalShort = totalShort.wmul(tokenOut);

        totalRawCollateral = totalRawCollateral.sub(redeemingAmount);
        tokenOutstanding.totalLongToken = tokenOutstanding.totalLongToken.sub(totalLong.toInt256());
        tokenOutstanding.totalShortToken = tokenOutstanding.totalShortToken.sub(totalShort.toInt256());

        longToken.safeTransferFrom(msg.sender, address(this), totalLong);
        shortToken.safeTransferFrom(msg.sender, address(this), totalShort);

        longToken.burn(totalLong);
        shortToken.burn(totalShort);

        quoteToken.safeTransfer(msg.sender, redeemingAmount);
        emit Redeemed(msg.sender, tokenOut, totalLong, totalShort);
    }

    // function addLiquidity(Side side, uint256 leverageTokenAmount, uint256 quoteTokenAmount) public nonReentrant() {
    //     require( side != Side.FLAT , "Side must be long or short" );

    //     quoteToken.safeTransferFrom(msg.sender, address(this), quoteTokenAmount);

    //     // TODO: track the LP tokens received
    //     if (side == Side.LONG) {
    //         longToken.transferFrom(msg.sender, address(this), leverageTokenAmount);
    //         pmmLong.depositBase(leverageTokenAmount);
    //         pmmLong.depositQuote(quoteTokenAmount);
    //     } else {
    //         shortToken.transferFrom(msg.sender, address(this), leverageTokenAmount);
    //         pmmShort.depositBase(leverageTokenAmount);
    //         pmmShort.depositQuote(quoteTokenAmount);
    //     }

    //     emit AddedLiquidity(msg.sender, side, leverageTokenAmount, quoteTokenAmount);
    // }

    function queryBuyLeveragedToken(Side side, uint256 amount) public view returns (uint256) {
        if (side == Side.LONG) {
            return pmmLong.queryBuyBaseToken(amount);
        } else {
            return pmmShort.queryBuyBaseToken(amount);
        }
    }

    function querySellLeveragedToken(Side side, uint256 amount) public view returns (uint256) {
        if (side == Side.LONG) {
            return pmmLong.querySellBaseToken(amount);
        } else {
            return pmmShort.querySellBaseToken(amount);
        }
    }

    // not used
    function buyLeveragedToken(Side side, uint256 amount, uint256 max) public nonReentrant() {
        require( side != Side.FLAT , "Side must be long or short" );

        if (side == Side.LONG) {
            uint256 quoteTokenAmount = pmmLong.queryBuyBaseToken(amount);
            quoteToken.safeTransferFrom(msg.sender, address(this), quoteTokenAmount);
            pmmLong.buyBaseToken(amount, max);
            longToken.transfer(msg.sender, amount);
        } else {
            uint256 quoteTokenAmount = pmmShort.queryBuyBaseToken(amount);
            quoteToken.safeTransferFrom(msg.sender, address(this), quoteTokenAmount);
            pmmShort.buyBaseToken(amount, max);
            shortToken.transfer(msg.sender, amount);
        }

        emit BuyLeveragedToken(msg.sender, side, amount);
    }

     // not used
    function sellLeveragedToken(Side side, uint256 amount, uint256 min) public nonReentrant() {
        require( side != Side.FLAT , "Side must be long or short" );

        if (side == Side.LONG) {
            longToken.transferFrom(msg.sender, address(this), amount);
            uint256 quoteTokenAmount = pmmLong.querySellBaseToken(amount);
            pmmLong.sellBaseToken(amount, min);  
            quoteToken.transfer(msg.sender, quoteTokenAmount);
        } else {
            shortToken.transferFrom(msg.sender, address(this), amount);
            uint256 quoteTokenAmount = pmmShort.querySellBaseToken(amount);
            pmmShort.sellBaseToken(amount, min);
            quoteToken.transfer(msg.sender, quoteTokenAmount);
        }

        emit SellLeveragedToken(msg.sender, side, amount);
    }

    // ONLY ADMIN

    // Setup PMM contract address
    function setupPmm(address pmmLongAddress, address pmmShortAddress) external onlyWhitelisted() {
        pmmLong = IPmm(pmmLongAddress);
        pmmShort = IPmm(pmmShortAddress);

        require( address(longToken) ==  address(pmmLong.baseToken()),"Invalid base token on pmm long");
        require( address(quoteToken) == address(pmmLong.quoteToken()) ,"Invalid quote token on pmm long");
        require( address(shortToken) ==  address(pmmShort.baseToken()),"Invalid base token on pmm short");
        require( address(quoteToken) == address(pmmShort.quoteToken()) ,"Invalid quote token on pmm short");

        quoteToken.approve( pmmLongAddress, MAX);
        longToken.approve( pmmLongAddress, MAX);
        quoteToken.approve(pmmShortAddress, MAX);
        shortToken.approve( pmmShortAddress, MAX);
    }

    // INTERNAL FUNCTIONS
    // Check if amm address is set.
    modifier pmmRequired() {
        require(address(pmmLong) != address(0), "no pmmLong is set");
        require(address(pmmShort) != address(0), "no pmmLong is set");
        _;
    }

    function _estimateTokenOut() internal view returns (uint256, uint256) {
        (int256 longCoeff, int256 shortCoeff) = priceResolver.currentCoefficient();
        int256 startingPrice = (priceResolver.getStartingPrice()).toInt256();
        int256 halfCurrentPrice = (priceResolver.getCurrentPrice().div(2)).toInt256();

        int256 longPrice = startingPrice.wmul(longCoeff);
        int256 shortPrice = startingPrice.wmul(shortCoeff);

        return (halfCurrentPrice.wdiv(longPrice).toUint256(), halfCurrentPrice.wdiv(shortPrice).toUint256());
    }

    

}