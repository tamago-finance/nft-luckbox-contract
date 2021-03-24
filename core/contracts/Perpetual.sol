// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/IPmm.sol";
import "./TokenFactory.sol";

/**
 * @title Perpetual contract
 */

contract Perpetual is Lockable, Whitelist {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    enum Leverage {ONE, TWO, THREE, FOUR}
    enum Side {FLAT, SHORT, LONG} 

    struct LiquidityProvider {
        // Raw collateral value
        uint256 rawCollateral;
        // Total tokens have been minted
        uint256 totalMinted;
    }

    struct LiquidityData {
        // synthetic
        uint256 base;
        uint256 availableBase;
        // collateral
        uint256 quote;
        uint256 availableQuote;
    }

    struct PositionData {
        uint256 rawCollateral;
        uint256 leveragedAmount;
        uint256 positionSize;
        Side side;
        Leverage leverage;
        uint256 entryValue;
        uint entryTimestamp;
        bool locked;
    }

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // PMM contract.
    IPmm public pmm;
    // The collateral currency used to back the positions in this contract.
    IERC20 public collateralCurrency;
    // Synthetic token created by this contract.
    IExpandedIERC20 public tokenCurrency;
    // Liquidity Provider Data
    mapping (address => LiquidityProvider) public liquidityProviders;
    // Maps sponsor addresses to their positions. Each sponsor can have only one position.
    mapping(address => PositionData) public positions;
    // Keep track of the raw collateral across all positions
    uint256 public rawTotalPositionCollateral;
    // Total liquidity
    LiquidityData public totalLiquidity;
    
    uint256 constant MAX = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1
    uint256 constant liquidationRatio = 1250000000000000000; // 1.25
    uint256 constant maintenanceRatio = 1500000000000000000; // 1.5

    event CreatedPerpetual();
    event AddLiquidity(address indexed sender, uint256 collateralAmount, uint256 numTokens);
    event RemoveLiquidity(address indexed sender, uint256 collateralAmount, uint256 numTokens);
    event NewLiquidityProvider(address indexed sponsor);
    event PositionCreated(address indexed sender, uint256 collateralAmount, uint256 positionSize, Side side, Leverage leverage, uint256 price);


    constructor(
        string memory _name,
        string memory _symbol,
        address _tokenFactoryAddress,
        address _priceFeederAddress,
        address _collateralAddress
    ) public nonReentrant() { 
        require(_priceFeederAddress != address(0), "Invalid PriceFeeder address");
        require(_tokenFactoryAddress != address(0), "Invalid TokenFactory address");
        require(_collateralAddress != address(0), "Invalid Colleteral token address");

        // Setup synthetic token
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        tokenCurrency = tf.createToken(_name, _symbol, 18);
        
        priceFeeder = IPriceFeeder(_priceFeederAddress);
        collateralCurrency = IERC20(_collateralAddress);

        addAddress(msg.sender);

        emit CreatedPerpetual();
    }

    // Setup PMM contract address
    function setupPmm(address pmmAddress) external onlyWhitelisted() {
        pmm = IPmm(pmmAddress);
        require( address(tokenCurrency) ==  address(pmm.baseToken()),"Invalid PMM base token");
        require( address(collateralCurrency) == address(pmm.quoteToken()) ,"Invalid PMM quote token");
        tokenCurrency.approve(pmmAddress , MAX);
        collateralCurrency.approve(pmmAddress , MAX);
        // Initial fund PMM with 1 SYNTH
        tokenCurrency.mint(address(this), ONE);
        pmm.depositBase(ONE);

    }

    // Get synthetic token address
    function getTokenCurrency() public view returns (address)
    {
        return address(tokenCurrency);
    }

    // trade functions
    
    // open long position
    function openLongPosition(uint256 positionSize, uint256 maxCollateralAmount, Leverage leverage)
        public
        nonReentrant()
        pmmRequired()
    {
        PositionData storage positionData = positions[msg.sender];

        require(positionSize > 0, "amount must be greater than 0");
        require(positionData.locked == false , "Position is locked");

        uint256 leveragedSize = positionSize.mul(_resolveLeverage(leverage));

        uint256 borrowingAmount = pmm.queryBuyBaseToken(leveragedSize);
        uint256 currentPrice = borrowingAmount.wdiv(leveragedSize);
        uint256 collateralAmount = positionSize.wmul(currentPrice);

        require(maxCollateralAmount >= collateralAmount, "collateralAmount > maxCollateralAmount");
        require(borrowingAmount < totalLiquidity.availableQuote, "Not enough liquidity");

        pmm.buyBaseToken(leveragedSize, borrowingAmount);

        // Increase the position and global collateral balance by collateral amount.
        _incrementCollateralBalances(positionData, collateralAmount, borrowingAmount, leveragedSize, Side.LONG, leverage, currentPrice );

        totalLiquidity.availableQuote = totalLiquidity.availableQuote.sub(borrowingAmount);
        totalLiquidity.availableBase = totalLiquidity.availableBase.add(leveragedSize);
        totalLiquidity.base = totalLiquidity.base.add(leveragedSize);

        emit PositionCreated(msg.sender, collateralAmount, leveragedSize, Side.LONG, leverage, currentPrice);

        collateralCurrency.transferFrom(msg.sender, address(this), collateralAmount);
    }

    // open short position

    // add liquidity
    function addLiquidity(uint256 collateralAmount) 
        public
        nonReentrant()
        pmmRequired()
    {
        require(collateralAmount > 0, "amount must be greater than 0");

        LiquidityProvider storage liquidityData = liquidityProviders[msg.sender];

        if (liquidityData.totalMinted == 0) {
            emit NewLiquidityProvider(msg.sender);
        }
        // Mint corresponding synthetic tokens and deposit to PMM
        uint256 spotPrice = pmm.getMidPrice();
        uint256 numTokens = collateralAmount.wdiv(spotPrice);
        liquidityData.totalMinted = liquidityData.totalMinted.add(numTokens);
        liquidityData.rawCollateral = liquidityData.rawCollateral.add(collateralAmount);

        totalLiquidity.quote = totalLiquidity.quote.add(collateralAmount);
        totalLiquidity.availableQuote = totalLiquidity.availableQuote.add(collateralAmount);

        require(tokenCurrency.mint(address(this), numTokens), "Minting synthetic tokens failed");

        pmm.depositBase(numTokens);

        emit AddLiquidity(msg.sender, collateralAmount, numTokens);
        // Transfer tokens into this contract
        collateralCurrency.transferFrom(msg.sender, address(this), collateralAmount);
    }

    // remove liquidity (ex. 100% = 1e18)
    function removeLiquidity(uint256 percentage) 
        public
        nonReentrant()
        pmmRequired()
    {
        require(percentage <= ONE, "percentage>1");
        require(percentage > 0, "percentage=0");

        LiquidityProvider storage liquidityData = liquidityProviders[msg.sender];

        uint256 collateral = liquidityData.rawCollateral.wmul(percentage);
        uint256 numTokens = liquidityData.totalMinted.wmul(percentage);

        require( totalLiquidity.availableQuote >= collateral , "Insufficient available collateral" );

        liquidityData.totalMinted = liquidityData.totalMinted.sub(numTokens);
        liquidityData.rawCollateral = liquidityData.rawCollateral.sub(collateral);

        totalLiquidity.quote = totalLiquidity.quote.sub(collateral);
        totalLiquidity.availableQuote = totalLiquidity.availableQuote.sub(collateral);

        // Withdraw synthetics from PMM and burn
        pmm.withdrawBase(numTokens);
        tokenCurrency.burn(numTokens);

        emit RemoveLiquidity(msg.sender, collateral, numTokens);
        collateralCurrency.transfer(msg.sender, collateral);
    }


    // INTERNAL FUNCTIONS

    // Check if amm address is set.
    modifier pmmRequired() {
        require(address(pmm) != address(0), "no pmm is set");
        _;
    }

    function _resolveLeverage(Leverage leverage) pure internal returns (uint256) {
        if (leverage == Leverage.FOUR) {
            return 4;
        } else if (leverage == Leverage.THREE) {
            return 3;
        } else if (leverage == Leverage.TWO) {
            return 2;
        } else {
            return 1;
        }
    }

    function _incrementCollateralBalances(
        PositionData storage positionData,
        uint256 collateralAmount,
        uint256 leveragedAmount,
        uint256 size,
        Side side,
        Leverage leverage,
        uint256 price
    ) internal {
        positionData.rawCollateral = positionData.rawCollateral.add(collateralAmount);
        rawTotalPositionCollateral = rawTotalPositionCollateral.add(collateralAmount);

        positionData.leveragedAmount = positionData.leveragedAmount.add(leveragedAmount);
        positionData.positionSize = positionData.positionSize.add(size);
        positionData.side = side;
        positionData.leverage = leverage;
        positionData.entryValue = price;
        positionData.entryTimestamp = block.timestamp;
        positionData.locked = true;

    }

}
