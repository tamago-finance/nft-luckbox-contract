// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./ISide.sol";

interface IPriceResolver is ISide {

    function getCurrentPrice() external view returns (uint256);

    function getPriceFeederLong() external view returns (address);

    function getPriceFeederShort() external view returns (address);

    function getAdjustedPrice() external view returns (uint256, uint256);

}