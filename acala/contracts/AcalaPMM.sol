// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./v1/Pmm.sol";

/**
 * @title Wrapper for PMM contract
 */

contract AcalaPMM is Pmm {

    constructor(
        address _tokenFactoryAddress,
        address _perpertualAddress,
        address _baseToken,
        address _quoteToken,
        address _priceFeeder,
        uint256 _k
    )
        public
        Pmm(
            _tokenFactoryAddress,
            _perpertualAddress,
            _baseToken,
            _quoteToken,
            _priceFeeder,
            _k
        )
    {

    }

}
