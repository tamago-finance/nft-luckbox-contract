// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@openzeppelin/contracts/access/Ownable.sol';
import "../utility/Whitelist.sol";
import "../interfaces/IChainlinkPriceFeeder.sol";

contract MockPriceFeeder is Whitelist, IChainlinkPriceFeeder {
    uint256 public value = 1000000000000000000;
    int256 public pastValue = 1000000000000000000;
    uint256 public averagePrice = 1000000000000000000;
    uint256 private timestamp;
    
    string public name;

    constructor(string memory _name) public {
        name = _name;
        timestamp = now;
        addAddress(msg.sender);
    }

    function updateValue(uint256 _newValue) public onlyWhitelisted {
        value = _newValue;
        timestamp = now;
    }

    function getValue() public override view returns (uint256) {
        return value;
    }

    function getTimestamp() public override view returns (uint256) {
        return timestamp;
    }

    function getPastValue(uint8 dayAgo)
        external
        view
        override
        returns (int256, uint256)
    {
        return (pastValue,now);
    }

    function setPastValue(int256 _newValue) public onlyWhitelisted {
        pastValue = _newValue;
    }

    function getAveragePrice(uint8 totalDay)
        external
        view
        override
        returns (uint256, uint8)
    {
        return (averagePrice,6);
    }

    function setAveragePrice(uint256 _newValue) public onlyWhitelisted {
        averagePrice = _newValue;
    }

}
