const { expect } = require("chai");
const { fromEther, toEther, deployPriceResolverMock } = require("./Helpers")

let priceResolver
let nftManager
let tamgToken
let shareToken
let syntheticNft

let admin
let alice
let bob
let charlie

describe("NFTManager contract with mock feeders", () => {

    before(async () => {

        [admin, alice, bob, charlie] = await ethers.getSigners();

        const PriceResolver = await ethers.getContractFactory("PriceResolver");
        const NFTManager = await ethers.getContractFactory("NFTManager");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");

        priceResolver = await deployPriceResolverMock({ PriceResolver, MockPriceFeeder, admin })

        tamgToken = await MockERC20.deploy("Tamago Token", "TAMG")
        shareToken = await MockERC20.deploy("Share Token", "SHARE")

        nftManager = await NFTManager.deploy(
            "Ang Bao USD",
            "https://api.cryptokitties.co/kitties/{id}",
            priceResolver.address,
            shareToken.address,
            ethers.utils.formatBytes32String("USDC-TAMG-SHARE/USD"),
            tamgToken.address,
            ethers.utils.formatBytes32String("TAMG/USD"),
            ethers.utils.formatBytes32String("USD"),
            admin.address
        )

        // setup NFT variants
        await nftManager.addSyntheticVariant("Ang Bao 1 USD", 1, toEther(1))
        await nftManager.addSyntheticVariant("Ang Bao 10 USD", 2, toEther(10))
        await nftManager.addSyntheticVariant("Ang Bao 100 USD", 3, toEther(100))

    });

    it('verify initial params', async () => {

        // intial params
        expect( await nftManager.name() ).to.equal("Ang Bao USD")
        expect( await nftManager.priceResolver()).to.equal( priceResolver.address)
        expect( await nftManager.collateralShare()).to.equal( shareToken.address)
        expect( await nftManager.redeemToken()).to.equal( tamgToken.address)
        expect( await nftManager.devAddress()).to.equal( admin.address)

        // check prices
        expect(await nftManager.getRedeemTokenPrice()).to.equal(toEther(0.4))
        expect(await nftManager.getSyntheticPrice()).to.equal(toEther(1))
        expect(await nftManager.getCollateralSharePrice()).to.equal(toEther(1380000))

        // base URI of ERC-1155

        const syntheticNftAddress = await nftManager.syntheticNFT()
        syntheticNft = await ethers.getContractAt('SyntheticNFT', syntheticNftAddress)

        expect( await syntheticNft.uri(0)).to.equal("https://api.cryptokitties.co/kitties/{id}")

        // check variants
        const firstVariant = await nftManager.syntheticVariants(0);
        expect( firstVariant[0] ).to.equal("Ang Bao 1 USD")
        expect( firstVariant[1] ).to.equal(1)
        expect( firstVariant[2] ).to.equal( toEther(1) )

        const secondVariant = await nftManager.syntheticVariants(1);
        expect( secondVariant[0] ).to.equal("Ang Bao 10 USD")
        expect( secondVariant[1] ).to.equal(2)
        expect( secondVariant[2] ).to.equal(toEther(10))

        const thirdVariant = await nftManager.syntheticVariants(2);
        expect( thirdVariant[0] ).to.equal("Ang Bao 100 USD")
        expect( thirdVariant[1] ).to.equal(3)
        expect( thirdVariant[2] ).to.equal(toEther(100))

    })

})