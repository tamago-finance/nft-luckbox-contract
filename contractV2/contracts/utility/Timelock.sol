// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC20.sol";
import "./SafeERC20.sol";
import "./Lockable.sol";

contract Timelock is Ownable, Lockable {

	using SafeERC20 for IERC20;

	struct Batch {
		uint256 amount;
		uint256 unlockBlock;
		bool canWithdraw;
	}

	address public lockToken;
	Batch[] public batchesInfo;	

	event Deposit(address indexed account, uint256 amount, uint256 unlockBlock);
	event Withdraw(address indexed account, uint256 amount, uint256 batchId);

	// must provide the token address
	constructor(address _lockToken) public nonReentrant() {
		lockToken = _lockToken;
	}

	// return total batch in the system
	function totalBatch() public view returns (uint256) {
		return batchesInfo.length;
	}

	// return the batch's block to be released
	function getBatchUnlockBlock(uint256 _batchId) public view returns (uint256) {
		return batchesInfo[_batchId].unlockBlock;
	}

	// return the batch's amount
	function getBatchAmount(uint256 _batchId) public view returns (uint256) {
		return batchesInfo[_batchId].amount;
	}

	// check the withdraw status
	function getBatchWithdrawStatus(uint256 _batchId) public view returns (bool) {
		return batchesInfo[_batchId].canWithdraw;
	}

	// deposit the token until reach the given _unlockBlock
	function deposit(uint256 _amount, uint256 _unlockBlock) public onlyOwner nonReentrant {
		require(block.number < _unlockBlock, "Invalid given unlockBlock");
		IERC20(lockToken).safeTransferFrom(msg.sender, address(this), _amount);
		batchesInfo.push(
			Batch(_amount, _unlockBlock, true)
		);
		emit Deposit(msg.sender, _amount, _unlockBlock);
	}

	// withdraw the token if the unlockBlock is reached 
	function withdraw(uint256 _batchId) public onlyOwner nonReentrant {
		require(_batchId < batchesInfo.length, "Invalid given batchId");
		Batch storage batch = batchesInfo[_batchId];
		require(batch.canWithdraw, "Withdraw status is locked");
		uint256 amount = batch.amount;
		uint256 unlockBlock = batch.unlockBlock;
		require(block.number >= unlockBlock, "You can not withdraw before unlockBlock");
		batch.amount = 0;
		batch.unlockBlock = 0;
		batch.canWithdraw = false;
		IERC20(lockToken).safeTransfer(msg.sender, amount);
		emit Withdraw(msg.sender, amount, _batchId);
	}

}