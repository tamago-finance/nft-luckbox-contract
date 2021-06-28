// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./ISide.sol";

interface IPriceResolver is ISide {

    function getCurrentPrice() external view returns (uint256);

    function getPriceFeederLong() external view returns (address);

    function getPriceFeederShort() external view returns (address);

    function getStartingPrice() external view returns (uint256);

    function getAdjustedPrice() external view returns (uint256, uint256);

    function currentCoefficient() external view returns (int256, int256);

}