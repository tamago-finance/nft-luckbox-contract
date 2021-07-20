// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC20.sol";
import "./IExpandedIERC20.sol";

/**
 * @dev Interface of the PMM contract
 */
interface IExchangePair {

    // spot price
    function getMidPrice() external view returns (uint256);

    // deposit base token
    function depositBase(uint256 value) external;

    // deposit quote token
    function depositQuote(uint256 value) external;

    // withdraw base token
    function withdrawBase(uint256 value) external;

    // withdraw quote token
    function withdrawQuote(uint256 value) external;

    function getQuoteBalance() external view returns (uint256);

    function getBaseBalance() external view returns (uint256);

    function queryBuyBaseToken(uint256 amount) external view returns (uint256);

    function querySellBaseToken(uint256 amount) external view returns (uint256);

    function buyBaseToken(uint256 amount, uint256 maxPayQuote) external;

    function sellBaseToken(uint256 amount, uint256 minReceiveQuote) external;

}