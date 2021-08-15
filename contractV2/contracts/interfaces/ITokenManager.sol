// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IExpandedIERC20.sol";
import "./IToken.sol";

interface ITokenManager {

    function syntheticToken() external view returns (IExpandedIERC20);

    function supportCollateralToken() external view returns (IToken);

    function baseCollateralToken() external view returns (IToken);

}