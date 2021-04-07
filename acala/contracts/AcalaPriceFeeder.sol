// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./v1/interfaces/IPriceFeeder.sol";

/**
 * @title Modify to use Acala's generic oracle and on-chain scheduler contracts
 */

interface ISchedule {
    event ScheduledCall(address indexed sender, address indexed contract_address, bytes task_id);
    event CanceledCall(address indexed sender, bytes task_id);
    event RescheduledCall(address indexed sender, bytes task_id);

    // Schedule call the contract.
    // Returns a boolean value indicating whether the operation succeeded.
    function scheduleCall(
        address contract_address, // The contract address to be called in future.
        uint256 value, // How much native token to send alone with the call.
        uint256 gas_limit, // The gas limit for the call. Corresponding fee will be reserved upfront and refunded after call.
        uint256 storage_limit, // The storage limit for the call. Corresponding fee will be reserved upfront and refunded after call.
        uint256 min_delay, // Minimum number of blocks before the scheduled call will be called.
        bytes calldata input_data // The input data to the call.
    )
    external
    returns (bool); // Returns a boolean value indicating whether the operation succeeded.

    // Cancel schedule call the contract.
    // Returns a boolean value indicating whether the operation succeeded.
    function cancelCall(
        bytes calldata task_id // The task id of the scheduler. Get it from the `ScheduledCall` event.
    )
    external
    returns (bool); // Returns a boolean value indicating whether the operation succeeded.

    // Reschedule call the contract.
    // Returns a boolean value indicating whether the operation succeeded.
    function rescheduleCall(
        uint256 min_delay, // Minimum number of blocks before the scheduled call will be called.
        bytes calldata task_id // The task id of the scheduler. Get it from the `ScheduledCall` event.
    )
    external
    returns (bool); // Returns a boolean value indicating whether the operation succeeded.
}

contract ADDRESS {
	address public constant ACA = 0x0000000000000000000000000000000001000000;
	address public constant AUSD = 0x0000000000000000000000000000000001000001;
	address public constant DOT = 0x0000000000000000000000000000000001000002;
	address public constant LDOT = 0x0000000000000000000000000000000001000003;
	address public constant XBTC = 0x0000000000000000000000000000000001000004;
	address public constant RENBTC = 0x0000000000000000000000000000000001000005;
	address public constant POLKABTC = 0x0000000000000000000000000000000001000006;
	address public constant PLM = 0x0000000000000000000000000000000001000007;
	address public constant PHA = 0x0000000000000000000000000000000001000008;
	address public constant HDT = 0x0000000000000000000000000000000001000009;
	address public constant KAR = 0x0000000000000000000000000000000001000080;
	address public constant KUSD = 0x0000000000000000000000000000000001000081;
	address public constant KSM = 0x0000000000000000000000000000000001000082;
	address public constant LKSM = 0x0000000000000000000000000000000001000083;
	address public constant SDN = 0x0000000000000000000000000000000001000087;
	address public constant KILT = 0x000000000000000000000000000000000100008A;
	address public constant StateRent = 0x0000000000000000000000000000000000000800;
	address public constant Oracle = 0x0000000000000000000000000000000000000801;
	address public constant Schedule = 0x0000000000000000000000000000000000000802;
	address public constant DEX = 0x0000000000000000000000000000000000000803;
}

interface IOracle {
    // Get the price of the currency_id.
    // Returns the price.
    function getPrice(address token) external view returns (uint256);
}

contract AcalaPriceFeeder is IPriceFeeder, ADDRESS {

    uint256 public value;
    uint256 private timestamp;
    // Prevent infinite loop (not 100% sure that we need to define it)
    uint remainingCount;
    // Price Feeder name
    string public name;
    // Token address
    address public token;

    uint256 constant period = 150; // 15 minutes

    ISchedule scheduler = ISchedule(ADDRESS.Schedule);
    IOracle oracle = IOracle(ADDRESS.Oracle);

    // count = 2880 for 1 mo. length
    constructor(string memory _name, address _token, uint _count) public {
        
        remainingCount = _count;
        timestamp = now;
        name = _name;
        token = _token;

        scheduler.scheduleCall(address(this), 0, 100000, 100, period, abi.encodeWithSignature("requestPrice()"));
    }

    function extendCount(uint total) public {
        require(remainingCount == 1, "remainingCount is not equals 1");

        remainingCount += total;
        scheduler.scheduleCall(address(this), 0, 100000, 100, period, abi.encodeWithSignature("requestPrice()"));
    }

    function getValue() public override view returns (uint256) {
        return value;
    }

    function getTimestamp() public override view returns (uint256) {
        return timestamp;
    }

    function requestPrice() public {
        require(msg.sender == address(this));

        if (remainingCount != 1) {
            value = oracle.getPrice(token);
            timestamp = now;
            remainingCount--;
            scheduler.scheduleCall(address(this), 0, 100000, 100, period, abi.encodeWithSignature("pay()"));
        } 

    } 

}
