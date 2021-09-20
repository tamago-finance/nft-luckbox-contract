pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC20.sol";
import "./SafeERC20.sol";

contract Timelock is Ownable {

	using SafeERC20 for IERC20;

	struct Batch {
		uint256 amount;
		uint256 unlockBlock;
		bool canWithdraw;
	}

	address public lockToken;
	Batch[] public batchesInfo;	

	event Deposit(address indexed account, uint256 amount, uint256 unlockBlock);
	event Withdraw(address indexed account, uint256 amount);

	constructor(address _lockToken) public {
		lockToken = _lockToken;
	}

	function deposit(uint256 _amount, uint256 _unlockBlock) public onlyOwner {
		require(block.number < _unlockBlock, "UnlockBlock must more than block number");
		IERC20(lockToken).safeTransferFrom(msg.sender, address(this), _amount);
		batchesInfo.push(
			Batch(_amount, _unlockBlock, true)
		);
		emit Deposit(msg.sender, _amount, _unlockBlock);
	}

	function withdraw(uint256 _batchId) public onlyOwner {
		require(_batchId < batchesInfo.length, "Over range of batches");
		Batch storage batch = batchesInfo[_batchId];
		require(batch.canWithdraw, "This batchId is withdraw already");
		uint256 amount = batch.amount;
		uint256 unlockBlock = batch.unlockBlock;
		require(block.number >= unlockBlock, "You can not withdraw before unlockBlock");
		batch.amount = 0;
		batch.unlockBlock = 0;
		batch.canWithdraw = false;
		IERC20(lockToken).safeTransfer(msg.sender, amount);
		emit Withdraw(msg.sender, amount);
	}
}