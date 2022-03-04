const { expect } = require("chai");
const { ethers } = require("hardhat");

let nftBroker;
let erc1155;

let admin;
let alice;
let bob;
let charlie;

const DEV_ADDRESS = "0x91C65f404714Ac389b38335CccA4A876a8669d32";

describe("NFTBroker", () => {
  before(async () => {
    [admin, alice, bob, charlie] = await ethers.getSigners();

    const NFTBroker = await ethers.getContractFactory("NFTBroker");
    const MockERC1155 = await ethers.getContractFactory("MockERC1155");

    nftBroker = await NFTBroker.deploy();
    erc1155 = await MockERC1155.deploy(
      "https://api.cryptokitties.co/kitties/{id}"
    );
    const tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    //minting ERC-1155
    for (let id of tokenIds) {
      await erc1155.mint(admin.address, id, 10, "0x00");
    }
    await erc1155.setApprovalForAll(nftBroker.address, true);
  });

  it("Should deposit successfully", async () => {
    await nftBroker.deposit(erc1155.address, 1, 0);

    expect(await erc1155.balanceOf(admin.address, 0)).to.equal(9);
    expect(await erc1155.balanceOf(nftBroker.address, 0)).to.equal(1);
  });
});
