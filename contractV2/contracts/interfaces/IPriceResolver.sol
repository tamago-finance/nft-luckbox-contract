// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IPriceResolver {

    function getCurrentPrice() external view returns (uint256);

    function getCurrentPriceCollateral() external view returns (uint256);

    function getCurrentRatio() external view returns (uint256);

    function getRawRatio() external view returns (uint256);

    function getAvg30Price() external view returns (uint256);

    function getAvg60Price() external view returns (uint256);

    function isBullMarket() external view returns (bool);

}