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

}