// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./utility/synthetix/interfaces/IAddressResolver.sol";
import "./utility/synthetix/interfaces/IDepot.sol";
import "./utility/synthetix/interfaces/ISynthetix.sol";
import "./utility/synthetix/interfaces/ICollateralLoan.sol";
import "./utility/synthetix/CollateralEth.sol";
import "./utility/synthetix/CollateralState.sol";
import "./interfaces/IPriceFeeder.sol";
import "./interfaces/IPmm.sol";
import "./TokenFactory.sol";

contract Perpetual is Lockable, Whitelist, ICollateralLoan {
    using LibMathSigned for int256;
    using LibMathUnsigned for uint256;
    using SafeERC20 for IERC20;

    enum Leverage {ONE, TWO}
    enum Side {FLAT, SHORT, LONG}
    enum CollateralizationStatus {SAFE, WARNING, DANGER}
    enum ContractState {Initial, Ready, Emergency, Expired}


    struct PositionData {
        uint256 rawCollateral;
        uint256 leveragedAmount;
        uint256 positionSize;
        Side side;
        Leverage leverage;
        uint256 entryValue;
        uint entryTimestamp;
    }

    // Contract state
    ContractState public contractState;
    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // PMM contract.
    IPmm public pmm;

    // Synthetix
    IAddressResolver public synthetixResolver;
    ISynthetix public synthetix;
    IERC20 public synthQuoteToken;
    bytes32 public synthQuoteCurrency;
    IERC20 public synthBaseToken;
    bytes32 public synthBaseCurrency;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event CreatedPerpetual();
    event AddLiquidity(address indexed sender, uint256 totalBase, uint256 totalQuote);

    constructor(
        address _tokenFactoryAddress,
        address _priceFeederAddress,
        address _synthetixResolverAddress,
        address _synthQuoteTokenAddress,
        bytes32 _synthQuoteCurrency,
        address _synthBaseTokenAddress,
        bytes32 _synthBaseCurrency
    ) public nonReentrant() {
        require(
            _tokenFactoryAddress != address(0),
            "Invalid TokenFactory address"
        );
        require(
            _synthetixResolverAddress != address(0),
            "Invalid Synthetix Resolver address"
        );
        require(
            _synthQuoteTokenAddress != address(0),
            "Invalid Quote token address"
        );
        require(
            _synthBaseTokenAddress != address(0),
            "Invalid Base token address"
        );

        priceFeeder = IPriceFeeder(_priceFeederAddress);

        synthetixResolver = IAddressResolver(_synthetixResolverAddress);
        synthQuoteToken = IERC20(_synthQuoteTokenAddress);
        synthBaseToken = IERC20(_synthBaseTokenAddress);

        synthQuoteCurrency = _synthQuoteCurrency;
        synthBaseCurrency = _synthBaseCurrency;

        synthetix = ISynthetix(synthetixResolver.getAddress("Synthetix"));
        synthQuoteToken.approve(address(synthetix), MAX);

        addAddress(msg.sender);

        contractState = ContractState.Initial;

        emit CreatedPerpetual();
    }

    // Set PMM contract address / initial funding
    function setup(address pmmAddress)
        external
        payable
        nonReentrant()
        onlyWhitelisted()
    {
        pmm = IPmm(pmmAddress);
        IDepot depot = IDepot(synthetixResolver.getAddress("Depot"));

        require(
            address(synthBaseToken) == address(pmm.baseToken()),
            "Invalid PMM base token"
        );
        require(
            address(synthQuoteToken) == address(pmm.quoteToken()),
            "Invalid PMM quote token"
        );
        require(
            address(depot) != address(0),
            "Depot is missing from Synthetix resolver"
        );
        require(
            contractState == ContractState.Initial,
            "Invalid contract state"
        );

        synthBaseToken.approve(pmmAddress, MAX);
        synthQuoteToken.approve(pmmAddress, MAX);

        // swaps ETH -> sUSD
        depot.exchangeEtherForSynths{value: msg.value}();
        uint256 totalQuote = synthQuoteToken.balanceOf(address(this));

        uint256 half = totalQuote.div(2);
        // sTSLA and other equity token can't be traded during off-hours
        synthetix.exchange(synthQuoteCurrency, half, synthBaseCurrency);
    }

    // Complete setup process
    function completeSetup() external nonReentrant() onlyWhitelisted() {
        require(
            contractState == ContractState.Initial,
            "Invalid contract state"
        );

        uint256 totalQuote = synthQuoteToken.balanceOf(address(this));
        uint256 totalBase = synthBaseToken.balanceOf(address(this));

        // Deposit base and quote tokens into PMM
        pmm.depositQuote(totalQuote);
        pmm.depositBase(totalBase);

        contractState = ContractState.Ready;
    }

    // Get synthetic token address
    function getBaseToken() public view returns (address) {
        return address(synthBaseToken);
    }

    // Get quote token address
    function getQuoteToken() public view returns (address) {
        return address(synthQuoteToken);
    }

    // get mid price
    function getMidPrice() public view pmmRequired() returns (uint256) {
        return pmm.getMidPrice();
    }

    // get index price
    function getIndexPrice() public view returns (uint256) {
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

    // get max loan 
    function getMaxLoan(uint256 collateralAmount)
        public 
        view
        returns (uint256)
    {
        return _maxLoan(collateralAmount);
    }

    // find minimum collateral amount
    function minCollateralAmount()
        public
        view
        returns (uint)
    {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        require(
            address(collateralEth) != address(0),
            "CollateralEth is missing from Synthetix resolver"
        );
        return collateralEth.minCollateral();
    }

    // return collateral ratio on the given loan id
    function getCollateralRatio(uint256 loanId)
        public
        view
        returns (uint256)
    {
        CollateralState collateralStateEth = CollateralState(synthetixResolver.getAddress("CollateralStateEth"));
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        require(
            address(collateralStateEth) != address(0),
            "CollateralStateEth is missing from Synthetix resolver"
        );
        require(
            address(collateralEth) != address(0),
            "CollateralEth is missing from Synthetix resolver"
        );

        Loan memory loan = collateralStateEth.getLoan(address(this), loanId);

        return collateralEth.collateralRatio(loan);
    }


    // only admin can deposit, weight, default is 0.5 means 50% base / 50% quote, 0 - 0% base / 100% quote, 1 - 100% base / 0% quote
    function depositLiquidity(uint256 weight)
        public
        payable
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        IDepot depot = IDepot(synthetixResolver.getAddress("Depot"));
        require(
            address(depot) != address(0),
            "Depot is missing from Synthetix resolver"
        );
        require( msg.value > 0 , "msg.value must be greater than 0" );
        require( weight >= 0 && weight <= ONE , "invalid weight");
        // swaps ETH -> sUSD and deposit in the contract
        depot.exchangeEtherForSynths{value: msg.value}();

        uint256 total = synthQuoteToken.balanceOf(address(this));
        uint256 totalBase = total.wmul(weight);
        synthetix.exchange(synthQuoteCurrency, totalBase, synthBaseCurrency);
    }

    function completeDepositLiquidity() 
        public
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        uint256 totalQuote = synthQuoteToken.balanceOf(address(this));
        uint256 totalBase = synthBaseToken.balanceOf(address(this));

        // Deposit base and quote tokens into PMM
        pmm.depositQuote(totalQuote);
        pmm.depositBase(totalBase);

        emit AddLiquidity(msg.sender, totalBase, totalQuote); 
    }

    // TRADE FUNCTIONS


    // open long position
    function openLongPosition(uint256 positionSize) public payable nonReentrant() isReady() {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));

        uint256 amount = msg.value;
        uint256 loanAmount = pmm.queryBuyBaseToken(positionSize);

        collateralEth.open{value: amount}(
            loanAmount,
            synthQuoteCurrency
        );

        pmm.buyBaseToken(positionSize.wmul(970000000000000000), loanAmount);

        

    }

    // open short position
    function openShortPosition() public payable nonReentrant() isReady() {}

    // INTERNAL FUNCTIONS

    // Check if amm address is set.
    modifier pmmRequired() {
        require(address(pmm) != address(0), "no pmm is set");
        _;
    }

    // check if contract state is set to ready
    modifier isReady() {
        require(
            contractState == ContractState.Ready,
            "contract state is not ready"
        );
        _;
    }

    function _maxLoan(uint256 collateralAmount) isReady() internal view returns (uint256) {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        return collateralEth.maxLoan(collateralAmount, synthQuoteCurrency );
    }

}
