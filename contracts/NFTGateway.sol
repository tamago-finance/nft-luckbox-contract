// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "./NFTMarketplace.sol";


/**
 * @title Gateway Contract
 */

contract Gateway is
    ReentrancyGuard,
    NFTMarketplace
{
    using Address for address;

    struct Message {
        bytes32 root;
        uint256 orders;
        address relayer;
        uint timestamp;
    }

    // Chain ID
    uint256 public chainId; 
    // Each message contains Merkle Tree's root of all orders listed from all EVM chains
    mapping(uint256 => Message) public messages;
    uint256 public messageCount;

    constructor(address _devAddress) public NFTMarketplace(_devAddress) {
        chainId = _getCurrentChainID();
    }

    // override the chain ID
    function setChainId(uint256 _value) external onlyAdmin {
        chainId = _value;
    }
    
    // INTERNAL FUNCTIONS

    function _getCurrentChainID() internal view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function _eligibleToSwapCrosschain(
        uint256 _orderId,
        address _orderOwner,
        address _assetAddress,
        uint256 _tokenId,
        bytes32[] memory _proof
    ) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_orderId, _getCurrentChainID() , _orderOwner , _assetAddress, _tokenId));
        bytes32 latestRoot = messages[messageCount].root;
        return MerkleProof.verify(_proof, latestRoot, leaf);
    }

    
}
