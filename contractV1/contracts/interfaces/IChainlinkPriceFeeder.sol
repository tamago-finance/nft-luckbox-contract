// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./IPriceFeeder.sol";

interface IChainlinkPriceFeeder is IPriceFeeder {

    function getPastValue(uint8 dayAgo) external view returns (int256, uint256);

    function getAveragePrice(uint8 totalDay) external view returns (uint256, uint8);

}