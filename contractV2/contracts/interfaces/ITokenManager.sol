// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IExpandedIERC20.sol";
import "./IERC20.sol";

interface ITokenManager {

    function syntheticToken() external view returns (IExpandedIERC20);

    function supportCollateralToken() external view returns (IERC20);

    function baseCollateralToken() external view returns (IERC20);

}