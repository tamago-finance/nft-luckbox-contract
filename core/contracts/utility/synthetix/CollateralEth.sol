// SPDX-License-Identifier: MIT

pragma solidity >=0.5.16;

pragma experimental ABIEncoderV2;

import "./interfaces/ICollateralEth.sol"; 
import "./Collateral.sol";

contract CollateralEth is ICollateralEth, Collateral {

    mapping(address => uint) public pendingWithdrawals;

    function open(uint amount, bytes32 currency) override external payable {
        // openInternal(msg.value, amount, currency, false);
    }

    function close(uint id) override external {
        // uint collateral = closeInternal(msg.sender, id);

        // pendingWithdrawals[msg.sender] = pendingWithdrawals[msg.sender].add(collateral);
    }

    function deposit(address borrower, uint id) override external payable {
        // depositInternal(borrower, id, msg.value);
    }

    function withdraw(uint id, uint withdrawAmount) override external {
        // uint amount = withdrawInternal(id, withdrawAmount);

        // pendingWithdrawals[msg.sender] = pendingWithdrawals[msg.sender].add(amount);
    }

    function repay(
        address account,
        uint id,
        uint amount
    ) override external {
        // repayInternal(account, msg.sender, id, amount);
    }

    function draw(uint id, uint amount) external {
        // drawInternal(id, amount);
    }

    function liquidate(
        address borrower,
        uint id,
        uint amount
    ) override external {
        // uint collateralLiquidated = liquidateInternal(borrower, id, amount);

        // pendingWithdrawals[msg.sender] = pendingWithdrawals[msg.sender].add(collateralLiquidated);
    }

    function claim(uint amount) override external {
        // If they try to withdraw more than their total balance, it will fail on the safe sub.
        // pendingWithdrawals[msg.sender] = pendingWithdrawals[msg.sender].sub(amount);

        // (bool success, ) = msg.sender.call.value(amount)("");
        // require(success, "Transfer failed");
    }

    

}