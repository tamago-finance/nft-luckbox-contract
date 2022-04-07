const { expect } = require("chai")
const { ethers, upgrades } = require("hardhat")
const { MerkleTree } = require('merkletreejs')
const keccak256 = require("keccak256")

let marketplace
let erc1155
let erc721

let admin
let alice
let bob
let charlie
let dev

describe("NFT Marketplace", () => {

    beforeEach(async () => {
        [admin, alice, bob, charlie, dev] = await ethers.getSigners()

        const NFTMarketplaceUpgradeable = await ethers.getContractFactory("NFTMarketplaceUpgradeable")
        const Registry = await ethers.getContractFactory("Registry");
        const MockERC1155 = await ethers.getContractFactory("MockERC1155")
        const MockERC721 = await ethers.getContractFactory("MockERC721")

        registry = await Registry.deploy()

        erc1155 = await MockERC1155.deploy(
            "https://api.cryptokitties.co/kitties/{id}"
        )
        erc721 = await MockERC721.deploy("Mock NFT", "MOCK")

        marketplace = await upgrades.deployProxy(NFTMarketplaceUpgradeable, [
            registry.address,
            dev.address
        ]);

    })

    it("basic create an order and cancel it", async () => {
        
        // mint ERC-1155
        await erc1155.mint(admin.address, 1, 1, "0x00")
        // mint ERC-721
        await erc721.mint(admin.address, 1)

        await erc1155.setApprovalForAll(marketplace.address, true)
        await erc721.setApprovalForAll(marketplace.address, true)

        // create orders
        await marketplace.createOrder(1, erc1155.address, 1, true, ethers.utils.formatBytes32String("") )
        await marketplace.createOrder(2, erc721.address, 1, false, ethers.utils.formatBytes32String("") )

        expect( await erc1155.balanceOf(admin.address , 1)).to.equal(0)
        expect( await erc721.balanceOf(admin.address)).to.equal(0)

        try {
            await marketplace.connect(alice).cancelOrder(1)
        } catch (e) {
            expect(e.message.indexOf("You are not the owner") !== -1).to.true
        }

        // cancel orders
        await marketplace.connect(admin).cancelOrder(1)
        await marketplace.connect(admin).cancelOrder(2)

        expect( await erc1155.balanceOf(admin.address , 1)).to.equal(1)
        expect( await erc721.balanceOf(admin.address)).to.equal(1)
    })
})