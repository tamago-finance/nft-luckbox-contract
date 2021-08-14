// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

pragma experimental ABIEncoderV2;

import "./interfaces/ICollateralLoan.sol";

contract CollateralState is ICollateralLoan {

    mapping(address => Loan[]) public loans;

    function getLoan(address account, uint256 loanID) external view returns (Loan memory) {
        Loan[] memory accountLoans = loans[account];
        for (uint i = 0; i < accountLoans.length; i++) {
            if (accountLoans[i].id == loanID) {
                return (accountLoans[i]);
            }
        }
    }

    function getNumLoans(address account) external view returns (uint numLoans) {
        return loans[account].length;
    }
    
}