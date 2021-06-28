// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

interface IReserves {

    function deposit(address tokenAddress, uint256 amount) external;

    function withdraw(address tokenAddress, uint256 amount) external;

    function getReserves(address tokenAddress) external view returns (uint256);

}