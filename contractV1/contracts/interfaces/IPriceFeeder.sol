// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;


import "./ISide.sol";

interface IPriceFeeder is ISide {
    
    function getValue() external view returns (uint256);

    function getTimestamp() external view returns (uint);

    function getSide() external view returns (Side);

}