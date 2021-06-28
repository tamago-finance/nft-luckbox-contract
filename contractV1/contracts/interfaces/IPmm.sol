// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC20.sol";
import "./IExpandedIERC20.sol";

/**
 * @dev Interface of the PMM contract
 */
interface IPmm {

    // overridden by state variable
    function quoteToken() external view returns (IERC20);

    // overridden by state variable
    function baseToken() external view returns (IERC20);

    // overridden by state variable
    function baseCapitalToken() external view returns (IExpandedIERC20);

    // overridden by state variable
    function quoteCapitalToken() external view returns (IExpandedIERC20);

    // spot price
    function getMidPrice() external view returns (uint256);

    // deposit base token
    function depositBase(uint256 value) external returns (uint256);

    // deposit quote token
    function depositQuote(uint256 value) external returns (uint256);

    // withdraw base token
    function withdrawBase(uint256 value) external returns (uint256);

    // withdraw quote token
    function withdrawQuote(uint256 value) external returns (uint256);

    function queryBuyBaseToken(uint256 amount) external view returns (uint256);

    function querySellBaseToken(uint256 amount) external view returns (uint256);

    function buyBaseToken(uint256 amount, uint256 maxPayQuote) external returns (uint256);

    function sellBaseToken(uint256 amount, uint256 minReceiveQuote) external returns (uint256);
}