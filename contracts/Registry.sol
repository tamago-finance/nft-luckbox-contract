// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./utility/Whitelist.sol";
import "./interfaces/IRegistry.sol";

/**
 * @title A contract to keep track of all contract in the system
 */

contract Registry is ReentrancyGuard, Whitelist, IRegistry {

    mapping(bytes32 => address) public contracts;
    mapping(uint256 => bytes32) public indexToContract;

    // total contract in the system
    uint256 public override contractCount;

    event ContractAdded(bytes32 name, address contractAddress);
    event ContractUpdated(bytes32 name, address contractAddress);

    /// @notice register a new contract 
    /// @param _name the name for resolve
    /// @param _contractAddress the contract address
    function registerContract(bytes32 _name, address _contractAddress) public override nonReentrant onlyWhitelisted {
        require( contracts[_name] == address(0) , "The given name is occupied" );
        require(_name != "0x00", "Invalid _name");
        require(_contractAddress != address(0), "Invalid _contractAddress");

        contracts[_name] = _contractAddress;

        indexToContract[contractCount] = _name;
        contractCount += 1;

        emit ContractAdded(_name, _contractAddress);
    } 

    /// @notice update a contract address from a given name
    /// @param _name the contract name
    /// @param _contractAddress the new contract address
    function updateContract(bytes32 _name, address _contractAddress) public override nonReentrant onlyWhitelisted {
        require( contracts[_name] != address(0) , "The given name is incorrect" );

        contracts[_name] = _contractAddress;

        emit ContractUpdated(_name, _contractAddress);
    }

    /// @notice retrieve a contract address from a given name
    /// @param _name the contract name
    /// @return the contract address 
    function getContractAddress(bytes32 _name) public override view returns (address) {
        require( contracts[_name] != address(0) , "The given name is incorrect" );
        return contracts[_name];
    }

}
