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
    enum DepositState {None, Depositing}

    struct LiquidityData {
        uint256 base;
        uint256 availableBase;
        uint256 quote;
        uint256 availableQuote;
    }

    // Contract state
    ContractState public contractState;
    // Deposit state
    DepositState public depositState;
    // Price feeder contract.
    IPriceFeeder public priceFeeder;
    // PMM contract.
    IPmm public pmm;
    // Total liquidity
    LiquidityData public totalLiquidity;

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
    event AddLiquidity(address indexed sender, uint256 loanId, uint256 totalBase, uint256 totalQuote);

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

    // Set PMM contract address
    function setup(address pmmAddress)
        external
        nonReentrant()
        onlyWhitelisted()
    {
        pmm = IPmm(pmmAddress);

        require(
            address(synthBaseToken) == address(pmm.baseToken()),
            "Invalid PMM base token"
        );
        require(
            address(synthQuoteToken) == address(pmm.quoteToken()),
            "Invalid PMM quote token"
        );
        require(
            contractState == ContractState.Initial,
            "Invalid contract state"
        );

        synthBaseToken.approve(pmmAddress, MAX);
        synthQuoteToken.approve(pmmAddress, MAX);

        contractState = ContractState.Ready;
    }

    // base token address
    function getBaseToken() public view returns (address) {
        return address(synthBaseToken);
    }

    // quote token address
    function getQuoteToken() public view returns (address) {
        return address(synthQuoteToken);
    }

    // mid price
    function getMidPrice() public view pmmRequired() returns (uint256) {
        return pmm.getMidPrice();
    }

    // index price
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

    // LIQUIDITY PROVIDERS

    // Only admin can add/remove liquidity as there's no incentivize for v1
    // Weight based on the percentage of base token
    function depositLiquidity(uint256 weight)
        public
        payable
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));

        require( msg.value > 0 , "msg.value must be greater than 0" );
        require( weight >= 0 && weight <= ONE , "invalid weight");
        require(
            address(collateralEth) != address(0),
            "CollateralEth is missing from Synthetix resolver"
        );
        require( depositState == DepositState.None , "Invalid deposit state" );

        // Use 80% of max loan
        uint256 loanAmount = (_maxLoan(msg.value)).wmul(800000000000000000);

        collateralEth.open{value: msg.value}(
            loanAmount,
            synthQuoteCurrency
        );

        uint256 total = synthQuoteToken.balanceOf(address(this));
        uint256 totalBase = total.wmul(weight);
        synthetix.exchange(synthQuoteCurrency, totalBase, synthBaseCurrency);

        depositState = DepositState.Depositing;
    }

    function completeDepositLiquidity(uint256 loanId) 
        public
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {
        require( depositState == DepositState.Depositing , "Invalid deposit state" );

        uint256 totalQuote = synthQuoteToken.balanceOf(address(this));
        uint256 totalBase = synthBaseToken.balanceOf(address(this));

        // Deposit base and quote tokens into PMM
        pmm.depositQuote(totalQuote);
        pmm.depositBase(totalBase);

        // totalLiquidity.quote = totalLiquidity.quote.add(collateralAmount);
        // totalLiquidity.availableQuote = totalLiquidity.availableQuote.add(collateralAmount.div(2));
        // totalLiquidity.base = totalLiquidity.base.add(numTokens);
        // totalLiquidity.availableBase = totalLiquidity.availableBase.add(numTokens.div(2));

        depositState = DepositState.None;

        // emit AddLiquidity(msg.sender, totalBase, totalQuote); 
    }

    function removeLiquidity(uint256 loanId)
        public
        payable
        nonReentrant()
        isReady()
        onlyWhitelisted()
    {

    }

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
