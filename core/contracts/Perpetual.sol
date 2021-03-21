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

    struct LiquidityData {
        // Raw collateral value
        uint256 rawCollateral;
        // Total tokens have been minted
        uint256 totalMinted;
    }

    struct PositionData {
        // Raw collateral value
        int256 rawCollateral;
        uint256 size;
        Side side;
        uint256 entryValue;
        Leverage leverage;
    }

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // PMM contract.
    IPmm public pmm;
    // The collateral currency used to back the positions in this contract.
    IERC20 public collateralCurrency;
    // Synthetic token created by this contract.
    IExpandedIERC20 public tokenCurrency;
    // Liquidity Data
    mapping (address => LiquidityData) public liquidityProviders;
    // Total liquidity
    uint256 public totalLiquidity;
    // Total available liquidity for margin trade
    uint256 public availableLiquidity;

    uint256 constant MAX = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000;

    event CreatedPerpetual();
    event AddLiquidity(address indexed sender, uint256 collateralAmount, uint256 numTokens);
    event RemoveLiquidity(address indexed sender, uint256 collateralAmount, uint256 numTokens);
    event NewLiquidityProvider(address indexed sponsor);

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
        // Initial fund PMM with 1 SYNTH
        tokenCurrency.mint(address(this), ONE);
        pmm.depositBase(ONE);

    }

    // Get synthetic token address
    function getTokenCurrency() public view returns (address)
    {
        return address(tokenCurrency);
    }

    // deposit
    function depositForTrade(uint256 collateralAmount)
        public
        nonReentrant()
        pmmRequired()
    {
        require(collateralAmount > 0, "amount must be greater than 0");

    }


    // withdraw

    // add liquidity
    function addLiquidity(uint256 collateralAmount) 
        public
        nonReentrant()
        pmmRequired()
    {
        require(collateralAmount > 0, "amount must be greater than 0");

        LiquidityData storage liquidityData = liquidityProviders[msg.sender];

        if (liquidityData.totalMinted == 0) {
            emit NewLiquidityProvider(msg.sender);
        }
        // Mint corresponding synthetic tokens and deposit to PMM
        uint256 spotPrice = pmm.getMidPrice();
        uint256 numTokens = collateralAmount.wdiv(spotPrice);
        liquidityData.totalMinted = liquidityData.totalMinted.add(numTokens);
        liquidityData.rawCollateral = liquidityData.rawCollateral.add(collateralAmount);

        totalLiquidity = totalLiquidity.add(collateralAmount);
        availableLiquidity = availableLiquidity.add(collateralAmount);

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

        LiquidityData storage liquidityData = liquidityProviders[msg.sender];

        uint256 collateral = liquidityData.rawCollateral.wmul(percentage);
        uint256 numTokens = liquidityData.totalMinted.wmul(percentage);

        require( availableLiquidity >= collateral , "Insufficient available collateral" );

        liquidityData.totalMinted = liquidityData.totalMinted.sub(numTokens);
        liquidityData.rawCollateral = liquidityData.rawCollateral.sub(collateral);

        totalLiquidity = totalLiquidity.sub(collateral);
        availableLiquidity = availableLiquidity.sub(collateral);

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

}
