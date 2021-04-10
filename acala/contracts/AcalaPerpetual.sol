// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./v1/Perpetual.sol";

/**
 * @title Wrapper for Perpetual contract
 */

contract AcalaPerpetual is Perpetual {

    constructor(
        string memory _name,
        string memory _symbol,
        address _tokenFactoryAddress,
        address _priceFeederAddress,
        address _collateralAddress
    )
        public
        Perpetual(
            _name,
            _symbol,
            _tokenFactoryAddress,
            _priceFeederAddress,
            _collateralAddress
        )
    {

    }


}