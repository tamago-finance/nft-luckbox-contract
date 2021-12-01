// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utility/Whitelist.sol";
import "./interfaces/IPriceResolver.sol";
import "./interfaces/IPriceFeeder.sol";
import "./utility/LibMath.sol";


/**
 * @title A contract to resolves the asset price
 */

contract PriceResolver is ReentrancyGuard, Whitelist, IPriceResolver {

    

}