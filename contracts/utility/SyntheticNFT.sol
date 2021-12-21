//SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./Whitelist.sol";
import "../interfaces/ISyntheticNFT.sol";

/**
 * @title An ERC-1155 with permissioned burning and minting. The contract deployer will initially
 * be the owner who is capable of adding new roles.
 */

contract SyntheticNFT is ERC1155, Whitelist, ISyntheticNFT {

    constructor(string memory uri) public ERC1155(uri) {
        addAddress(msg.sender);
    }

    function mint(address to,
        uint256 id,
        uint256 value,
        bytes memory data)
        external
        override
        onlyWhitelisted
        returns (bool)
    {
        _mint(to, id, value, data);
        return true;
    }

    function mintBatch(
       address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external override onlyWhitelisted returns (bool) {
        _mintBatch(to, ids, values, data);
        return true;
    }

    function burn(
        address owner,
        uint256 id,
        uint256 value
    )
        external
        override
        onlyWhitelisted
    {
        _burn(owner, id, value);
    }

    function burnBatch(
        address owner,
        uint256[] memory ids,
        uint256[] memory values
    ) external override onlyWhitelisted {
        _burnBatch(owner, ids, values);
    }

    function setUri(string memory uri) external override onlyWhitelisted {
        _setURI(uri);
    }

}
