const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

let luckBox;
let erc1155;

let admin;
let alice;
let bob;
let charlie;
let dave;

describe("LuckBox V2 Upgradeable - polygon", () => {
  beforeEach(async () => {
    [admin, alice, bob, charlie, dave] = await ethers.getSigners();

    const LuckBoxUpgradeable = await ethers.getContractFactory(
      "LuckBoxUpgradeable"
    );
    const MockERC1155 = await ethers.getContractFactory("MockERC1155");
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const LINK_TOKEN = "0xb0897686c545045aFc77CF20eC7A532E3120E0F1"; // POLYGON LINK
    const VRF_COORDINATOR = "0x3d2341ADb2D31f1c5530cDC622016af293177AE0"; //POLYGON VRF COORDINATOR
    const KEY_HASH =
      "0xf86195cf7690c55907b2b611ebb7343a6f649bff128701cc542f0569e2c549da"; //POLYGON KEYHASH
    const FEE = "100000000000000"; // POLYGON VRF FEE (0.0001 LINK)

    erc1155 = await MockERC1155.deploy(
      "https://api.cryptokitties.co/kitties/{id}"
    );
    erc721 = await MockERC721.deploy("Mock NFT", "MOCK");
    erc20 = await MockERC20.deploy("Mock Token", "MOCK", 18);

    luckBox = await upgrades.deployProxy(LuckBoxUpgradeable, [
      LINK_TOKEN,
      VRF_COORDINATOR,
      KEY_HASH,
      FEE,
    ]);
  });

  it("Check whitelist users for project (1)", async () => {
    // generate merkle tree of whitelist users (without Dave)
    const leaves = [admin, alice, bob, charlie].map((item) =>
      keccak256(item.address)
    );
    const treeWL = new MerkleTree(leaves, keccak256, { sortPairs: true });
    // create a project
    await luckBox.createProject(1, "TEST");
    // attach WL's root
    const rootWL = treeWL.getHexRoot();
    root = treeWL.getRoot().toString("hex");
    await luckBox.attachWhitelist(1, rootWL);

    for (let user of [admin, alice, bob, charlie, dave]) {
      const proof = treeWL.getHexProof(keccak256(user.address));
      const valid = await luckBox.eligible(1, user.address, proof);

      if (user !== dave) {
        expect(valid).to.true;
      } else {
        expect(valid).to.false;
      }
    }
  });

  it("Setup a new event and let's Alice claims a POAP", async () => {
    // Mint 3 NFT, 2x each
    const tokenIds = [1, 2, 3];

    for (let id of tokenIds) {
      await erc1155.mint(admin.address, id, 2, "0x00");
      // also create a record
      await luckBox.createPoap(id, erc1155.address, id, true);
    }

    await erc1155.setApprovalForAll(luckBox.address, true);

    // deposit them to Luckbox
    for (let id of tokenIds) {
      await luckBox.depositERC1155(erc1155.address, id, 2);

      expect(await erc1155.balanceOf(luckBox.address, id)).to.equal(2);
    }

    // create an event with POAP ID 1,2,3
    await luckBox.createEvent(1, "EVENT", [1, 2, 3]);

    // generate merkle tree defines everyone can claims Poap 2
    const leaves = [admin, alice, bob, charlie].map((item) =>
      ethers.utils.keccak256(
        ethers.utils.solidityPack(["address", "uint256"], [item.address, 2])
      )
    );
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

    const root = tree.getHexRoot();

    // attach the root
    await luckBox.attachClaim(1, root);

    const proof = tree.getHexProof(
      ethers.utils.keccak256(
        ethers.utils.solidityPack(["address", "uint256"], [alice.address, 2])
      )
    );
    const result = await luckBox.connect(alice).checkClaim(1, 2, proof);

    expect(result).to.true;

    await luckBox.connect(alice).claim(1, 2, proof);

    // Alice receives 1 NFT
    expect(await erc1155.balanceOf(alice.address, 2)).to.equal(1);
  });

  it("should create Poap batch successfully", async () => {
    const poapId = [1, 2, 3];
    const assetAddress = [erc1155.address, erc1155.address, erc1155.address];
    const tokentId = [1, 2, 3];
    const is1155List = [true, false, true];

    await luckBox.createPoapBatch(poapId, assetAddress, tokentId, is1155List);
    expect((await luckBox.poaps(1)).assetAddress).to.equal(erc1155.address);
  });

  it("should error when array lenght is not equal", async () => {
    const poapId = [1, 2, 3, 4];
    const assetAddress = [erc1155.address, erc1155.address, erc1155.address];
    const tokentId = [1, 2, 3];
    const is1155List = [true, false, true];

    await expect(
      luckBox.createPoapBatch(poapId, assetAddress, tokentId, is1155List)
    ).to.revertedWith("Array size is not the same length");
  });

  it("should attach whitelist batch successfully", async () => {
    // generate merkle tree of whitelist users (without Dave)
    const leaves = [admin, alice, bob, charlie].map((item) =>
      keccak256(item.address)
    );
    const treeWL = new MerkleTree(leaves, keccak256, { sortPairs: true });
    // create a project
    await luckBox.createProject(1, "TEST");
    // attach WL's root
    const rootWL = [
      treeWL.getHexRoot(),
      treeWL.getHexRoot(),
      treeWL.getHexRoot(),
    ];
    root = treeWL.getRoot().toString("hex");
    const projId = [1, 2, 3];
    await luckBox.attachWhitelistBatch(projId, rootWL);
    expect((await luckBox.projects(1)).merkleRoot).to.equals(rootWL[1]);
  });

  // it("",async ()=>{

  // })

  it("Should update poaps successfully", async () => {
    await luckBox.createPoap(1, erc1155.address, 123, true);
    await luckBox.createPoap(2, erc1155.address, 231, true);
    await luckBox.createPoap(3, erc1155.address, 321, true);

    const eventId = 1;
    await luckBox.createEvent(eventId, "test12345", [1, 2, 3]);

    const newPoapId = [4, 5, 6];
    await luckBox.updatePoaps(eventId, newPoapId);
    // console.log(await luckBox.events(1));

    // expect((await luckBox.events(1)).poaps).to.equals(newPoapId);
  });

  it("Should emergencyWithdrawERC1155 successfully", async () => {
    // Mint 3 NFT, 2x each
    const tokenIds = [1, 2, 3];

    for (let id of tokenIds) {
      await erc1155.mint(admin.address, id, 2, "0x00");
      // also create a record
      await luckBox.createPoap(id, erc1155.address, id, true);
    }

    await erc1155.setApprovalForAll(luckBox.address, true);

    await luckBox.depositERC1155(erc1155.address, 1, 1);

    await luckBox.emergencyWithdrawERC1155(
      admin.address,
      erc1155.address,
      1,
      1
    );

    expect(await erc1155.balanceOf(admin.address, 1)).to.equals(2);
  });

  it("Should error in emergencyWithdrawERC1155", async () => {
    // Mint 3 NFT, 2x each
    const tokenIds = [1, 2, 3];

    for (let id of tokenIds) {
      await erc1155.mint(admin.address, id, 2, "0x00");
    }

    await expect(
      luckBox.emergencyWithdrawERC1155(admin.address, erc1155.address, 1, 1)
    ).to.revertedWith("ERC1155: insufficient balance for transfer");
  });

  it("Deposit & Withdraw ERC-721 NFTs to all slots", async () => {
    const tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // minting ERC-721
    for (let id of tokenIds) {
      await erc721.mint(admin.address, id);
    }

    await erc721.setApprovalForAll(luckBox.address, true);

    // depositing
    for (let id of tokenIds) {
      await luckBox.depositERC721(erc721.address, id);
    }

    expect(await erc721.balanceOf(admin.address)).to.equal(0);
    expect(await erc721.balanceOf(luckBox.address)).to.equal(9);

    // withdrawing
    for (let id of tokenIds) {
      await luckBox.emergencyWithdrawERC721(admin.address, erc721.address, id);
    }

    expect(await erc721.balanceOf(admin.address)).to.equal(9);
    expect(await erc721.balanceOf(luckBox.address)).to.equal(0);
  });

  it("Deposit & Withdraw ERC-20 to all slots", async () => {
    await erc20.faucet();
    await erc20.transfer(luckBox.address, 10);
    expect(await erc20.balanceOf(luckBox.address)).to.equal(10);

    await luckBox.emergencyWithdrawERC20(erc20.address, 10);
    expect(await erc20.balanceOf(luckBox.address)).to.equals(0);
  });

  it("Should set end event successfully", async () => {
    await luckBox.createPoap(1, erc1155.address, 123, true);
    await luckBox.createPoap(2, erc1155.address, 231, true);
    await luckBox.createPoap(3, erc1155.address, 321, true);

    const eventId = 1;
    await luckBox.createEvent(eventId, "test12345", [1, 2, 3]);
    await luckBox.setEndEvent(1, true);

    expect((await luckBox.events(1)).ended).to.equals(true);
  });
});
