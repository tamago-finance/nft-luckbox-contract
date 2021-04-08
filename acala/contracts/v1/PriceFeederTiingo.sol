// SPDX-License-Identifier: MIT

pragma solidity 0.6.9;

import "./utility/Ownable.sol";
import "./utility/Whitelist.sol";
import "./interfaces/IPriceFeeder.sol";
import "./utility/chainlink/ChainlinkClient.sol";

contract PriceFeederTiingo is ChainlinkClient, Whitelist, IPriceFeeder {

    // Chainlink 
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    uint256 private timestamp;
    string public name;
    uint256 public value;
    // Tiingo Ticker
    string public ticker;

    constructor(string memory _name, string memory _ticker, uint256 _intialValue) public {

        require(_intialValue > 0, "Wrong initial value");

        name = _name;
        timestamp = now;

        setPublicChainlinkToken();
        // Kovan Tiingo EOD Price Oracle
        oracle = 0x56dd6586DB0D08c6Ce7B2f2805af28616E082455;
        jobId = "4fbb2eec517440ca94982726f12ac523";
        ticker = _ticker;
        fee = 1 * 10 ** 18;
        value = _intialValue;

        addAddress(msg.sender);
    }

    // Get price
    function getValue() public override view returns (uint256) {
        return value;
    }

    // Get updated timestamp
    function getTimestamp() public override view returns (uint256) {
        return timestamp;
    }

    // Don't forget to fund LINK tokens to the contract
    function requestPrice(uint256 _newValue) public onlyWhitelisted() {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
        req.add("ticker", ticker);
        req.addInt("times", 100);
        sendChainlinkRequestTo(oracle, req, fee);
    }

    /**
     * Callback function
     */
    function fulfill(bytes32 _requestId, uint256 _result) public recordChainlinkFulfillment(_requestId) {
        value = _result * 1e10;
        timestamp = now;
    }

}