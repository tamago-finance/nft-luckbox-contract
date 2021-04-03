// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../utility/chainlink/ChainlinkClient.sol";

contract TiingoConsumer is ChainlinkClient {
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;
    
    string public ticker;
    
    uint256 public result;
    
    /*
    AAPL -> 12215000000 
    TSLA -> 66793000000
    */

    constructor(string memory _ticker) public {
        setPublicChainlinkToken();
        oracle = 0x56dd6586DB0D08c6Ce7B2f2805af28616E082455;
        jobId = "4fbb2eec517440ca94982726f12ac523";
        ticker = _ticker;
        fee = 1 * 10 ** 18;
    }
    
    /**
     * Initial request
     */
    function requestPrice() public {
        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
        req.add("ticker", ticker);
        req.addInt("times", 100);
        sendChainlinkRequestTo(oracle, req, fee);
    }
    
    /**
     * Callback function
     */
    function fulfill(bytes32 _requestId, uint256 _result) public recordChainlinkFulfillment(_requestId) {
        result = _result * 1e10;
    }
}