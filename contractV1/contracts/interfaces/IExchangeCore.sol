// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

interface IExchangeCore {
    
    function getQuoteToken() external view returns (address);
    
    function getQuoteBalance() external view returns (uint256);

    function fee() external view returns (uint256);

    function devAddress() external view returns (address);

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount, address recipient) external;
}
