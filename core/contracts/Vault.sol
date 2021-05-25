// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./utility/Lockable.sol";
import "./utility/Whitelist.sol";
import "./utility/LibMath.sol";
import "./utility/SafeERC20.sol";
import "./interfaces/IExpandedIERC20.sol";
import "./utility/synthetix/interfaces/IAddressResolver.sol";
import "./utility/synthetix/interfaces/ISynthetix.sol";
import "./utility/synthetix/CollateralEth.sol";

contract Vault is Lockable, Whitelist {
    // using LibMathSigned for int256;
    // using LibMathUnsigned for uint256;
    // using SafeERC20 for IERC20;

    // enum DepositState {None, Depositing}

    // struct Loan {
    //     uint256 loanId;
    //     bool active;
    // }

    // // Tracking Synthetix loans
    // uint256 public loanCount = 0;
    // mapping (uint256 => Loan) public loans;

    // // Deposit state
    // DepositState public depositState;

    // // Synthetix
    // IAddressResolver public synthetixResolver;
    // ISynthetix public synthetix;
    // IERC20 public synthToken;
    // bytes32 public synthCurrency;
    
    // // Helpers
    // uint256 constant MAX =
    //     0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    // uint256 constant ONE = 1000000000000000000; // 1

    // constructor(
    //     address _synthetixResolverAddress,
    //     address _synthTokenAddress,
    //     bytes32 _synthCurrency
    // ) public nonReentrant() {
    //     require(
    //         _synthetixResolverAddress != address(0),
    //         "Invalid Synthetix Resolver address"
    //     );
    //     require(
    //         _synthTokenAddress != address(0),
    //         "Invalid synth token address"
    //     );

    //     synthetixResolver = IAddressResolver(_synthetixResolverAddress);
    //     synthToken = IERC20(_synthTokenAddress);
    //     synthCurrency = _synthCurrency;

    //     synthetix = ISynthetix(synthetixResolver.getAddress("Synthetix"));
    //     synthToken.approve(address(synthetix), MAX);

    //     addAddress(msg.sender);
    // }

    // // assign new admin
    // function addAdmin(address user)
    //     public
    //     nonReentrant()
    //     onlyWhitelisted()
    // {
    //     require(
    //         address(user) != address(0),
    //         "Invalid address"
    //     );
    //     addAddress(user);
    // }

    // // LIQUIDITY PROVIDING
    // // Only admin can add/remove liquidity as there's no incentivize for v1
    // function depositLiquidity()
    //     public
    //     payable
    //     nonReentrant() 
    //     onlyWhitelisted()
    // {
    //     CollateralEth collateralEth = CollateralEth(synthetixResolver.getAddress("CollateralEth"));

    //     require( msg.value > 0 , "msg.value must be greater than 0" );
    //     require(
    //         address(collateralEth) != address(0),
    //         "CollateralEth is missing from Synthetix resolver"
    //     );
    //     require( depositState == DepositState.None , "Invalid deposit state" );

    //     // Use 80% of max loan
    //     uint256 loanAmount = (_maxLoan(msg.value)).wmul(800000000000000000);

    //     collateralEth.open{value: msg.value}(
    //         loanAmount,
    //         synthQuoteCurrency
    //     );

    //     depositState = DepositState.Depositing;
    // }

    // function completeDepositLiquidity(uint256 loanId) 
    //     public
    //     nonReentrant() 
    //     onlyWhitelisted()
    // {
    //     require( depositState == DepositState.Depositing , "Invalid deposit state" );

    //     // projects[loanCount].loanId = loanId;
    //     // projects[loanCount].active = true;
    //     // loanCount += 1;

    //     depositState = DepositState.None;
    // }


}