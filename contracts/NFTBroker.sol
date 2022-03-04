// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTBroker is Ownable, ReentrancyGuard, ERC1155Holder {
  using SafeERC20 for IERC20;

  address public nftAddress;
  uint256 public amount;

  struct Rate {
    address nftAddress;
    uint256 fromId;
    uint256 toId;
    uint8 rate;
  }

  //address -> fromId -> toId -> Rate
  mapping(address => mapping(uint256 => mapping(uint256 => Rate))) public rates;

  event Deposit(
    address indexed depositor,
    address nftAddress,
    uint256 tokenId,
    uint256 amount
  );

  constructor() public {}

  function deposit(
    address _nftAddress,
    uint256 _amount,
    uint256 _tokenId
  ) public onlyOwner nonReentrant {
    require(_amount > 0, "Can not zero bro");

    IERC1155(_nftAddress).safeTransferFrom(
      msg.sender,
      address(this),
      _tokenId,
      _amount,
      "0x00"
    );

    emit Deposit(msg.sender, _nftAddress, _tokenId, _amount);
  }
}
