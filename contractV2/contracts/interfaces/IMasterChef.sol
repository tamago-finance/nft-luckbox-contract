// SPDX-License-Identifier: MIT


pragma solidity 0.6.12;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IMigratorChef {
    // Perform LP token migration from legacy Elunium to newElunium.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to Elunium LP tokens.
    // Elunium must mint EXACTLY the same amount of Elunium LP tokens or
    // else something bad will happen. Traditional Elunium does not
    // do that so be careful!
    function migrate(IERC20 token) external returns (IERC20);
}