// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./utility/Ownable.sol";
import "./utility/Whitelist.sol";
import "./interfaces/IPriceFeeder.sol";


// TODO : Use this Chainlink node https://docs.chain.link/docs/tiingo-eod-stock-price-oracle

contract PriceFeeder is Whitelist, IPriceFeeder {
    uint256 public value = 100000; // wad unit
    uint256 private timestamp;
    
    string public name;

    constructor(string memory _name) public {
        name = _name;
        timestamp = now;
        addAddress(msg.sender);
    }

    function updateValue(uint256 _newValue) public onlyWhitelisted() {
        value = _newValue;
        timestamp = now;
    }

    function getValue() public override view returns (uint256) {
        return value;
    }

    function getTimestamp() public override view returns (uint256) {
        return timestamp;
    }
}
