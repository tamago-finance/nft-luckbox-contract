// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./ISyntheticNFT.sol";

interface ITokenManager {

    function syntheticNFT() external view returns (ISyntheticNFT);


}