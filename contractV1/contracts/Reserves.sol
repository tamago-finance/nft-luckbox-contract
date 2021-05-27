// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/SafeMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./interfaces/IReserves.sol";
import "./utility/synthetix/interfaces/IAddressResolver.sol";
import "./utility/synthetix/interfaces/ISynthetix.sol";
import "./utility/synthetix/interfaces/ICollateralLoan.sol";
import "./utility/synthetix/CollateralEth.sol";
import "./utility/synthetix/CollateralState.sol";

/**
 * @title Reserves contract 
 */

contract Reserves is Lockable, Whitelist, ICollateralLoan, IReserves {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    enum DepositState {None, Depositing}

    struct LoanData {
        uint256 index;
        uint256 loanId;
        bool active;
    }

    struct LoansData {
        uint256[] array;
        mapping(uint256 => LoanData) table;
    }

    // Tracking Synthetix loans
    LoansData private _loans;
    // Total ERC-20 reserves
    mapping(address => uint256) public reserves;
    // Deposit state
    DepositState public depositState;
    // Synthetix
    IAddressResolver public synthetixResolver;
    ISynthetix public synthetix;
    IERC20 public collateralToken;

    // Helpers
    uint256 constant MAX =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ONE = 1000000000000000000; // 1

    event Deposit(address indexed account, address indexed token,  uint256 indexed amount);
    event Withdraw(address indexed account, address indexed token,  uint256 indexed amount);


    constructor(address _synthetixResolverAddress) public nonReentrant() {
        require(
            _synthetixResolverAddress != address(0),
            "Invalid Synthetix Resolver address"
        );
        
        synthetixResolver = IAddressResolver(_synthetixResolverAddress);
        
        addAddress(msg.sender); 
    }

    function init() 
        public
        nonReentrant()
        onlyWhitelisted()
    {
        synthetix = ISynthetix(synthetixResolver.getAddress("Synthetix"));
        collateralToken = IERC20(synthetixResolver.getAddress("ProxyERC20sUSD"));

        collateralToken.approve(address(synthetix), MAX);
    }

    function deposit(address tokenAddress, uint amount)
        public
        override
        nonReentrant()
        onlyWhitelisted()
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0 , "Invalid amount");

        IERC20 token = IERC20(tokenAddress);
        token.safeTransferFrom(msg.sender, address(this), amount);

        _sync(tokenAddress);

        emit Deposit(msg.sender, tokenAddress, amount);
    }

    function withdraw(address tokenAddress, uint256 amount)
        public
        override
        onlyWhitelisted()
        nonReentrant()
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0 , "Invalid amount");
        require(reserves[tokenAddress] >= amount , "Insufficient amount");

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(msg.sender , amount);

        _sync(tokenAddress);

        emit Withdraw(msg.sender, tokenAddress, amount);
    }

    function convertSynthsUSD(bytes32 to, address tokenAddress, uint256 amount)
        public
        nonReentrant()
        onlyWhitelisted()
    {
        uint256 currentSynthsUSD = collateralToken.balanceOf(address(this));

        require( currentSynthsUSD >= amount, "Insufficient sUSD" );

        synthetix.exchange("sUSD", amount, to);

        _sync(tokenAddress);
        _sync(address(collateralToken));
    }

    function issueSynthsUSD()
        public
        payable
        nonReentrant()
        onlyWhitelisted()
    {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));

        require( msg.value > 0 , "msg.value must be greater than 0" );
        require(
            address(collateralEth) != address(0),
            "CollateralEth is missing from Synthetix resolver"
        );
        require( depositState == DepositState.None , "Invalid deposit state" );

        // Use 266% collateral ratio
        uint256 loanAmount = (_maxLoan(msg.value)).div(2);

        collateralEth.open{value: msg.value}(
            loanAmount,
            "sUSD"
        );

        depositState = DepositState.Depositing;
    }

    function completeIssueSynthsUSD(uint256 loanId) 
        public
        nonReentrant()
        onlyWhitelisted()
    {
        require( depositState == DepositState.Depositing , "Invalid deposit state" );

        uint256 index = _loans.array.length;
        _loans.array.push(loanId);
        LoanData storage loan = _loans.table[index];
        loan.index = index;
        loan.loanId = loanId;
        loan.active = true;

        depositState = DepositState.None;

        _sync(address(collateralToken));
    }

    // get max loan 
    function getMaxLoan(uint256 collateralAmount)
        public 
        view
        returns (uint256)
    {
        return _maxLoan(collateralAmount);
    }

    function getWaitingPeriod()
        public 
        view
        returns (uint256)
    {
        return _waitingPeriod();
    }

    function getLoanCount() public view returns (uint256)
    {
        return _loans.array.length;
    }

    function getLoanId(uint256 index) public view returns (uint256) 
    {
        return _loanId(index);
    }

    function getCollateralRatio(uint256 loanId) public view returns (uint256) 
    {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        CollateralState collateralEthState = CollateralState(synthetixResolver.getAddress("CollateralStateEth"));

        Loan memory loan = collateralEthState.getLoan(address(this) , loanId);
        return collateralEth.collateralRatio(loan);
    }

    function getReserves(address tokenAddress) external view override returns (uint256) {
        return reserves[tokenAddress];
    }

    function _sync(address tokenAddress) internal {
        IERC20 token = IERC20(tokenAddress);
        uint256 currentBalance = token.balanceOf(address(this));
        reserves[tokenAddress] = currentBalance;
    }

    function _maxLoan(uint256 collateralAmount) internal view returns (uint256) {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        return collateralEth.maxLoan(collateralAmount, "sUSD" );
    }

    function _waitingPeriod() internal view returns (uint256) {
        CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));
        return collateralEth.interactionDelay();
    }

    function _loanId(uint256 index) internal view returns (uint256) {
        return _loans.table[index].loanId;
    }


}