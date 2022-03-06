const { expect } = require("chai");

let admin
let alice
let bob
let charlie
let dev

let registry
let factory
let pair
let settlementNft
let nft1155
let nft721

describe("NFTSwapPair", () => {


    beforeEach(async () => {

        [admin, alice, bob, charlie, dev] = await ethers.getSigners();

        const Registry = await ethers.getContractFactory("Registry");
        const Factory = await ethers.getContractFactory("Factory")
        const Pair = await ethers.getContractFactory("NFTSwapPair")

        const MockERC721 = await ethers.getContractFactory("MockERC721")
        const MockERC1155 = await ethers.getContractFactory("MockERC1155")

        // deploy a registry
        registry = await Registry.deploy()

        // deploy a factory
        factory = await Factory.deploy(dev.address)

        // registry factory
        await registry.registerContract(ethers.utils.formatBytes32String("FACTORY"), factory.address)
        await factory.forceNonceUpdate(12345678);

        // setup mock NFTs
        settlementNft = await MockERC1155.deploy(
            "https://api.cryptokitties.co/kitties/{id}"
        )
        nft1155 = await MockERC1155.deploy(
            "https://api.cryptokitties.co/kitties/{id}"
        )
        nft721 = await MockERC721.deploy("Mock NFT", "MOCK")


        // deploy a pair
        pair = await Pair.deploy(
            "TEST PAIR",
            "TEST",
            settlementNft.address,
            1,
            registry.address
        )

        await pair.connect(admin).setCooldown(0)

        // Mint NFTs
        const Nfts = [settlementNft, nft1155, nft721]

        for (let i = 0; i < Nfts.length; i++) {

            const contract = Nfts[i]

            if (i !== 2) {
                // ERC1155
                await contract.connect(alice).mint(alice.address, 1, 10, "0x00")
                await contract.connect(admin).mint(admin.address, 1, 10, "0x00")

            } else {
                // ERC721
                await contract.connect(admin).mint(admin.address, 1)
                await contract.connect(alice).mint(alice.address, 2)
            }

        }

        // Approving
        for (let user of [admin, alice]) {
            await settlementNft.connect(user).setApprovalForAll(pair.address, true)
            await nft1155.connect(user).setApprovalForAll(pair.address, true)
            await nft721.connect(user).setApprovalForAll(pair.address, true)
        }

    });

    it("Deposit NFTs and withdraw immediately", async () => {

        // deposit 4 NFTs
        await pair.connect(admin).mint(admin.address, nft1155.address, 1, true)
        await pair.connect(alice).mint(alice.address, nft1155.address, 1, true)

        await pair.connect(admin).mint(admin.address, nft721.address, 1, false)
        await pair.connect(alice).mint(alice.address, nft721.address, 2, false)

        // verify
        expect(Number(await pair.totalSupply())).to.equal(4)
        expect(Number(await pair.balanceOf(admin.address))).to.equal(2)
        expect(Number(await pair.balanceOf(alice.address))).to.equal(2)

        expect(Number(await nft721.balanceOf(pair.address))).to.equal(2)
        expect(Number(await nft1155.balanceOf(pair.address, 1))).to.equal(2)
        expect(Number(await settlementNft.balanceOf(pair.address, 1))).to.equal(4)

        // withdraw 
        for (let user of [admin, alice]) {
            for (let i = 0; i < 2; i++) {
                await pair.connect(user).burn(user.address)
            }
        }

        expect(Number(await pair.totalSupply())).to.equal(0)
        expect(Number(await nft721.balanceOf(pair.address))).to.equal(0)
        expect(Number(await nft1155.balanceOf(pair.address, 1))).to.equal(0)
        expect(Number(await settlementNft.balanceOf(pair.address, 1))).to.equal(0)
    })


    it("Basic swaps by Bob", async () => {

        // prepare liquidity
        await pair.connect(admin).mint(admin.address, nft1155.address, 1, true)
        await pair.connect(alice).mint(alice.address, nft1155.address, 1, true)

        await pair.connect(admin).mint(admin.address, nft721.address, 1, false)
        await pair.connect(alice).mint(alice.address, nft721.address, 2, false)

        expect(Number(await pair.totalSupply())).to.equal(4)

        // perform swaps

        // mint a settlement NFT
        await settlementNft.connect(bob).mint(bob.address, 1, 1, "0x00")
        // mint NFT to be swapped
        await nft1155.connect(bob).mint(bob.address, 2, 1, "0x00")

        await settlementNft.connect(bob).setApprovalForAll(pair.address, true)
        await nft1155.connect(bob).setApprovalForAll(pair.address, true)

        await pair.connect(bob).swap(bob.address, nft1155.address, 2, true)

        // the total supply should be remains the same
        expect(Number(await pair.totalSupply())).to.equal(4)
        expect(Number(await nft1155.balanceOf(bob.address, 2))).to.equal(0)

        // bob should receives either mock ERC1155 (1) or ERC721 (1,2) back
        const balanceErc1155 = await nft1155.balanceOf(bob.address, 1)
        const balanceErc721 = await nft721.balanceOf(bob.address)
        expect(Number(balanceErc1155) + Number(balanceErc721)).to.equal(1)
    })

    it("Swaps shoud be failed when there's no settlement NFT", async () => {

        // prepare liquidity
        await pair.connect(admin).mint(admin.address, nft1155.address, 1, true)
        await pair.connect(alice).mint(alice.address, nft1155.address, 1, true)

        // perform swaps
        await nft1155.connect(bob).mint(bob.address, 2, 1, "0x00")

        try {
            await pair.connect(bob).swap(bob.address, nft1155.address, 2, true)
        } catch (e) {
            expect(e.message.indexOf("The caller has no any settlement NFT") !== -1).to.true
        }

    })

    it("Verify the cooldown guard is functional", async () => {

        // set cooldown to 1 hr.
        await pair.setCooldown(3600)

        await pair.connect(admin).mint(admin.address, nft1155.address, 1, true)
        await pair.connect(alice).mint(alice.address, nft1155.address, 1, true)

        // mint a settlement NFT
        await settlementNft.connect(bob).mint(bob.address, 1, 1, "0x00")
        // mint NFT to be swapped
        await nft1155.connect(bob).mint(bob.address, 2, 2, "0x00")

        await settlementNft.connect(bob).setApprovalForAll(pair.address, true)
        await nft1155.connect(bob).setApprovalForAll(pair.address, true)

        await pair.connect(bob).swap(bob.address, nft1155.address, 2, true)

        // should be failed here
        try {
            await pair.connect(bob).swap(bob.address, nft1155.address, 2, true)
        } catch (e) {
            expect(e.message.indexOf("Given recipient address still in cooldown period") !== -1).to.true
        }
        
        // then fast forward 1 hr.
        const { timestamp } = ( await ethers.provider.getBlock())

        await ethers.provider.send("evm_mine", [timestamp + 3600]);

        await pair.connect(bob).swap(bob.address, nft1155.address, 2, true)
    })

})