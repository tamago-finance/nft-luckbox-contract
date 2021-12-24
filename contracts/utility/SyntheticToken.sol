//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Whitelist.sol";
import "../interfaces/ISyntheticToken.sol";

/**
 * @title An ERC-20 with permissioned burning and minting. The contract deployer will initially
 * be the owner who is capable of adding new roles.
 */

contract SyntheticToken is ERC20, Whitelist, ISyntheticToken {
    
    constructor(
        string memory _tokenName,
        string memory _tokenSymbol,
        uint8 _tokenDecimals
    ) public ERC20(_tokenName, _tokenSymbol) {
        _setupDecimals(_tokenDecimals);
        addAddress(msg.sender);
    }
    
    function mint(address recipient, uint256 value)
        external
        override
        onlyWhitelisted
        returns (bool)
    {
        _mint(recipient, value);
        return true;
    }


    function burn(uint256 value)
        external
        override
        onlyWhitelisted
    {
        _burn(msg.sender, value);
    }
}
