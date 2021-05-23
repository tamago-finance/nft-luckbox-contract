// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/IPmm.sol";
import "./interfaces/IReserves.sol";
import "./utility/LibMath.sol";
import "./TokenFactory.sol";
import "./utility/synthetix/interfaces/IAddressResolver.sol";
import "./utility/synthetix/interfaces/ISynthetix.sol";
import "./utility/synthetix/interfaces/ICollateralLoan.sol";
import "./utility/synthetix/CollateralEth.sol";
import "./utility/synthetix/CollateralState.sol";

contract PositionManager is Lockable, Whitelist {

    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Reserves contract
    IReserves public reserves;
    // PMM contract.
    IPmm public pmm;
    // Leverage token created by this contract.
    IExpandedIERC20 public longToken;
    IExpandedIERC20 public shortToken;
    // Synthetix
    IAddressResolver public synthetixResolver;
    ISynthetix public synthetix;
    IERC20 public baseToken;
    bytes32 public baseCurrency;
    // Collateral Stablecoin
    IERC20 public collateralToken;
    // Keep track of base/quote tokens that locked in Position Manager
    uint256 public totalBaseToken;
    uint256 public totalQuoteToken;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event CreatedLeverageToken();

    constructor(
        string memory _name,
        string memory _symbol,
        address _tokenFactoryAddress,
        address _reservesAddress,
        address _priceFeederAddress,
        address _synthetixResolverAddress,
        address _baseTokenAddress,
        bytes32 _baseCurrency
    ) public nonReentrant() { 
        require( _tokenFactoryAddress != address(0), "Invalid Token Factory address" );
        require( _priceFeederAddress != address(0), "Invalid Price Feeder address" );
        require( _synthetixResolverAddress != address(0), "Invalid Synthetix Resolver address" );
        
        // Setup long/short tokens
        TokenFactory tf = TokenFactory(_tokenFactoryAddress);
        longToken = tf.createToken( string(abi.encodePacked(_name, " Long")), string(abi.encodePacked(_symbol, "-LONG")), 18);
        shortToken = tf.createToken( string(abi.encodePacked(_name, " Short")), string(abi.encodePacked(_symbol, "-SHORT")), 18);

        priceFeeder = IPriceFeeder(_priceFeederAddress);
        reserves = IReserves(_reservesAddress);
        synthetixResolver = IAddressResolver(_synthetixResolverAddress);
        // Alway use sUSD as a collateral
        collateralToken = IERC20(synthetixResolver.getAddress("ProxyERC20sUSD"));
        synthetix = ISynthetix(synthetixResolver.getAddress("Synthetix"));
        baseToken = IERC20(_baseTokenAddress);

        baseCurrency = _baseCurrency;

        addAddress(msg.sender);

        emit CreatedLeverageToken();
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

    // Get collateral token address
    function getCollateralToken() public view returns (address)
    {
        return address(collateralToken);
    }

    // Get quote token address
    function getBaseToken() public view returns (address)
    {
        return address(baseToken);
    }

    function buyLongToken(uint256 amount, uint256 maxCollateralAmount) public nonReentrant() pmmRequired() { 
        require(amount > 0, "amount must be greater than 0");

        uint256 buyingAmount = pmm.queryBuyBaseToken(amount);
        require(maxCollateralAmount >= buyingAmount, "Exceeding maxCollateralAmount");

        collateralToken.safeTransferFrom(msg.sender, address(this), buyingAmount);

        pmm.buyBaseToken(amount, buyingAmount);

        totalBaseToken = totalBaseToken.add(amount);

        require(longToken.mint(msg.sender, amount), "Minting synthetic tokens failed");
    }

    function buyShortToken(uint256 amount, uint256 maxCollateralAmount) public nonReentrant() pmmRequired() { 
        require(amount > 0, "amount must be greater than 0");

        uint256 collateralAmount = pmm.querySellBaseToken(amount);
        require(maxCollateralAmount >= collateralAmount, "Exceeding maxCollateralAmount");

        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount );

        reserves.withdraw(address(baseToken), amount );

        pmm.sellBaseToken(amount, collateralAmount);

        totalQuoteToken = totalQuoteToken.add(collateralAmount);

        reserves.deposit( address(collateralToken) , collateralAmount);

        require(shortToken.mint(msg.sender, amount), "Minting synthetic tokens failed");
    }

    function sellLongToken(uint256 amount) public nonReentrant() pmmRequired() { 
        require(amount > 0, "amount must be greater than 0");

        uint256 redeemAmount = pmm.querySellBaseToken(amount);
        pmm.sellBaseToken(amount, redeemAmount); 

        longToken.transferFrom(msg.sender, address(this), amount);

        totalBaseToken = totalBaseToken.sub(amount);

        collateralToken.transfer(msg.sender, redeemAmount); 
        longToken.burn(amount);
    }

    function sellShortToken(uint256 amount) public nonReentrant() pmmRequired() { 
        require(amount > 0, "amount must be greater than 0");

        // uint256 redeemAmount = pmm.queryBuyBaseToken(amount);
        

    }

    // get mid price
    function getMidPrice()
        public
        view
        pmmRequired()
        returns (uint256)
    {
        return pmm.getMidPrice();
    }

    // get index price
    function getIndexPrice()
        public
        view
        returns (uint256)
    {
        return priceFeeder.getValue();
    }

    // get buy price
    function getBuyPrice(uint256 amount)
        public
        view
        pmmRequired()
        returns (uint256)
    {
        return pmm.queryBuyBaseToken(amount);
    }

    // get sell price
    function getSellPrice(uint256 amount)
        public
        view
        pmmRequired()
        returns (uint256)
    {
        return pmm.querySellBaseToken(amount);
    }

    // ONLY ADMIN

    // Setup PMM contract address
    function setupPmm(address pmmAddress) external onlyWhitelisted() {
        pmm = IPmm(pmmAddress);
        require( address(baseToken) ==  address(pmm.baseToken()),"Invalid PMM base token");
        require( address(collateralToken) == address(pmm.quoteToken()) ,"Invalid PMM quote token");

        baseToken.approve(pmmAddress , MAX); 
        collateralToken.approve(pmmAddress , MAX);
        baseToken.approve(address(reserves) , MAX); 
        collateralToken.approve(address(pmmAddress) , MAX);
    }

    // just in case
    function syncSynthetixContracts() external onlyWhitelisted() {
        collateralToken = IERC20(synthetixResolver.getAddress("ProxyERC20sUSD"));
        synthetix = ISynthetix(synthetixResolver.getAddress("Synthetix"));
    }
    
    function depositBaseToken(uint256 amount) public nonReentrant() onlyWhitelisted() { 
        reserves.withdraw( address(baseToken) , amount);
        pmm.depositBase(amount);
    }

    function depositQuoteToken(uint256 amount) public nonReentrant() onlyWhitelisted() { 
        reserves.withdraw( address(collateralToken) , amount);
        pmm.depositQuote(amount);
    }

    // INTERNAL FUNCTIONS

    // Check if amm address is set.
    modifier pmmRequired() {
        require(address(pmm) != address(0), "no pmm is set");
        _;
    }
}