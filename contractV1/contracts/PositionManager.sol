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

    enum Leverage {ZERO, ONE, TWO}
    enum GlobalCollateralizationStatus {SAFE, WARNING, DANGER}

    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // Reserves contract
    IReserves public reserves;
    // PMM contract.
    IPmm public pmm;
    // Leveraged tokens created by this contract.
    IExpandedIERC20 public longToken;
    IExpandedIERC20 public shortToken;
    Leverage public leverage;
    // Synthetix
    IAddressResolver public synthetixResolver;
    ISynthetix public synthetix;
    IERC20 public baseToken;
    bytes32 public baseCurrency;
    // Collateral Stablecoin
    IERC20 public collateralToken;
    
    struct TokenOutstanding {
        uint256 totalLongToken;
        uint256 totalShortToken;
        int256 rawCollateral;
        int256 borrowedCollateral;
        int256 leveragedCollateral;
        int256 borrowedSynths;
    }

    // Total leveraged token token outstanding
    TokenOutstanding public tokenOutstanding;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event CreatedLeverageToken();

    constructor(
        string memory _name,
        string memory _symbol,
        Leverage _leverage,
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
        require( _leverage != Leverage.ZERO, "Leverage can't be zero" );
        
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
        leverage = _leverage;

        addAddress(msg.sender);

        emit CreatedLeverageToken();
    }

    function calculateCollateralLong(uint256 amount) public view  pmmRequired() returns (uint256) {
        require(amount > 0, "amount must be greater than 0");
        uint256 leveragedSize = amount.mul(_currentLeverage());
        uint256 borrowingAmount = pmm.queryBuyBaseToken(leveragedSize);
        return _calculateCollateralNeed(borrowingAmount);
    }

    function calculateCollateralShort(uint256 amount) public view  pmmRequired() returns (uint256) {
        require(amount > 0, "amount must be greater than 0");
        uint256 leveragedSize = amount.mul(_currentLeverage());
        uint256 borrowingAmount = pmm.querySellBaseToken(leveragedSize);
        return _calculateCollateralNeed(borrowingAmount);
    }

    function buyLongToken(uint256 amount, uint256 maxCollateralAmount)
        public 
        nonReentrant() 
        pmmRequired() 
    { 
        require(amount > 0, "amount must be greater than 0");

        uint256 leveragedSize = amount.mul(_currentLeverage());
        uint256 borrowingAmount = pmm.queryBuyBaseToken(leveragedSize);
        uint256 collateralAmount = _calculateCollateralNeed(borrowingAmount);

        require(maxCollateralAmount >= collateralAmount, "Exceeding maxCollateralAmount");
        // Collecting collateral from the user
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
        int256 totalLeveragedAmount = 0;
        tokenOutstanding.rawCollateral = tokenOutstanding.rawCollateral.add(collateralAmount.toInt256());
        totalLeveragedAmount = totalLeveragedAmount.add(collateralAmount.toInt256());

        if (borrowingAmount > collateralAmount) {
            uint256 topupAmount = borrowingAmount.sub(collateralAmount);
            _validateLeverageAmount(address(collateralToken), topupAmount);
            reserves.withdraw(address(collateralToken), topupAmount);
            tokenOutstanding.borrowedCollateral = tokenOutstanding.borrowedCollateral.add(topupAmount.toInt256());
            totalLeveragedAmount = totalLeveragedAmount.add(topupAmount.toInt256());
        }
        
        tokenOutstanding.leveragedCollateral = tokenOutstanding.leveragedCollateral.add(totalLeveragedAmount);

        pmm.buyBaseToken(leveragedSize, borrowingAmount);

        require(longToken.mint(msg.sender, leveragedSize), "Minting synthetic tokens failed");

        tokenOutstanding.totalLongToken = tokenOutstanding.totalLongToken.add(leveragedSize);
    }

    function sellLongToken(uint256 amount)
        public
        nonReentrant() 
        pmmRequired()
    {
        require(amount > 0, "amount must be greater than 0");

        // uint256 leveragedSize = amount.mul(_currentLeverage());
        uint256 redeemAmount = pmm.querySellBaseToken(amount);
        pmm.sellBaseToken(amount, redeemAmount); 

        uint256 returnedCollateral = _calculateCollateralNeed(redeemAmount);

        longToken.transferFrom(msg.sender, address(this), amount);

        int256 totalLeveragedAmount = 0;
        tokenOutstanding.rawCollateral = tokenOutstanding.rawCollateral.sub(returnedCollateral.toInt256());
        totalLeveragedAmount = totalLeveragedAmount.add(returnedCollateral.toInt256());

        if (redeemAmount > returnedCollateral) {
            uint256 topupAmount = redeemAmount.sub(returnedCollateral);
            reserves.deposit(address(collateralToken), topupAmount);
            tokenOutstanding.borrowedCollateral = tokenOutstanding.borrowedCollateral.sub(topupAmount.toInt256());
            totalLeveragedAmount = totalLeveragedAmount.add(topupAmount.toInt256());
        }

        tokenOutstanding.leveragedCollateral = tokenOutstanding.leveragedCollateral.sub(totalLeveragedAmount);
        tokenOutstanding.totalLongToken = tokenOutstanding.totalLongToken.sub(amount);

        collateralToken.transfer(msg.sender, returnedCollateral); 
        longToken.burn(amount);
    }

    function buyShortToken(uint256 amount, uint256 maxCollateralAmount) 
        public 
        nonReentrant() 
        pmmRequired() 
    { 
        require(amount > 0, "amount must be greater than 0");

        uint256 leveragedSize = amount.mul(_currentLeverage());
        uint256 borrowingAmount = pmm.querySellBaseToken(leveragedSize);
        uint256 collateralAmount = _calculateCollateralNeed(borrowingAmount);

        require(maxCollateralAmount >= collateralAmount, "Exceeding maxCollateralAmount");

        // Collecting collateral from the user
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
        // Borrow synthetic assets from the vault
        _validateLeverageAmount(address(baseToken), leveragedSize);
        reserves.withdraw(address(baseToken), leveragedSize);
        
        tokenOutstanding.rawCollateral = tokenOutstanding.rawCollateral.add(collateralAmount.toInt256());
        tokenOutstanding.leveragedCollateral = tokenOutstanding.leveragedCollateral.add(borrowingAmount.toInt256());
        tokenOutstanding.borrowedSynths = tokenOutstanding.borrowedSynths.add(leveragedSize.toInt256());

        pmm.sellBaseToken(leveragedSize, borrowingAmount); 

        require(shortToken.mint(msg.sender, borrowingAmount), "Minting synthetic tokens failed");

        tokenOutstanding.totalShortToken = tokenOutstanding.totalShortToken.add(borrowingAmount);
    }

    function testtest(uint256 amount) public view returns (uint256) 
     {
         uint256 spotPrice = pmm.getMidPrice();
        uint256 totalSynths = amount.wdiv(spotPrice);
        uint256 redeemAmount = pmm.queryBuyBaseToken(totalSynths);

        return redeemAmount;
     }

    function sellShortToken(uint256 amount) 
        public 
        nonReentrant() 
        pmmRequired() 
    { 
        require(amount > 0, "amount must be greater than 0");

        // FIXME: Find the better way to convert collateral -> synthetic
        uint256 spotPrice = pmm.getMidPrice();
        uint256 totalSynths = amount.wdiv(spotPrice);
        uint256 redeemAmount = pmm.queryBuyBaseToken(totalSynths);

        pmm.buyBaseToken(totalSynths, redeemAmount);

        uint256 returnedCollateral = _calculateCollateralNeed(redeemAmount);

        shortToken.transferFrom(msg.sender, address(this), amount);
        // return sUSD to the vault
        reserves.deposit(address(baseToken), totalSynths);

        tokenOutstanding.rawCollateral = tokenOutstanding.rawCollateral.sub(returnedCollateral.toInt256());
        tokenOutstanding.leveragedCollateral = tokenOutstanding.leveragedCollateral.sub(redeemAmount.toInt256());
        tokenOutstanding.borrowedSynths = tokenOutstanding.borrowedSynths.sub(totalSynths.toInt256());

        tokenOutstanding.totalShortToken = tokenOutstanding.totalShortToken.sub(amount);

        uint256 currentBalance = collateralToken.balanceOf(address(this));
        if (returnedCollateral > currentBalance) {
            uint256 topupAmount = returnedCollateral.sub(currentBalance);
            reserves.withdraw(address(collateralToken), topupAmount);
            tokenOutstanding.borrowedCollateral = tokenOutstanding.borrowedCollateral.add(topupAmount.toInt256());
        }

        collateralToken.transfer(msg.sender, returnedCollateral); 
        shortToken.burn(amount);
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

    function _validateLeverageAmount(address tokenAddress, uint256 amount) internal view {
        require( reserves.getReserves(tokenAddress) >= amount, "insufficient fund in the vault");
    }

    function _currentLeverage() internal view returns (uint256) {
        if (leverage == Leverage.TWO) {
            return 2;
        } else {
            return 1;
        }
    }

    function _calculateCollateralNeed(uint256 borrowingAmount) internal view returns (uint256) {
        if (leverage == Leverage.TWO) {
            return borrowingAmount.wmul(500000000000000000);
        } else {
            return borrowingAmount;
        }
    } 

    
}