// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

pragma experimental ABIEncoderV2;

import "./interfaces/ICollateralLoan.sol";
import "./CollateralState.sol";

contract Collateral is ICollateralLoan {

    uint public interactionDelay = 300;
    uint public minCollateral;

    function collateralRatio(Loan memory loan)
        public
        view
        returns (uint256 cratio)
    {
        // uint256 cvalue =
        //     _exchangeRates().effectiveValue(
        //         collateralKey,
        //         loan.collateral,
        //         sUSD
        //     );
        // uint256 dvalue =
        //     _exchangeRates().effectiveValue(
        //         loan.currency,
        //         loan.amount.add(loan.accruedInterest),
        //         sUSD
        //     );
        // cratio = cvalue.divideDecimal(dvalue);
    }

    // The maximum number of synths issuable for this amount of collateral
    function maxLoan(uint256 amount, bytes32 currency)
        public
        view
        returns (uint256 max)
    {
        // max = issuanceRatio().multiplyDecimal(
        //     _exchangeRates().effectiveValue(collateralKey, amount, currency)
        // );
    }



}
