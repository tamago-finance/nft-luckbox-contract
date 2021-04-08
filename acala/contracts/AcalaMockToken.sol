// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./v1/mocks/MockToken.sol";

/**
 * @title Mock USD stablecoin
 */

 contract AcalaMockToken is MockToken {

     constructor()
        public
        MockToken(
            "USD Stablecoin",
            "USDX"
        )
    {

    }

 }
