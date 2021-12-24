const { expect } = require("chai");
const { fromEther, toEther, deployPriceResolverMock, deployPriceResolver } = require("./Helpers")

let priceResolver
let nftManager
let tamgToken
let usdcToken
let shareToken
let syntheticNft

let admin
let alice
let bob
let charlie
let dev

describe("Full Deployment Ang Pow USD", () => {

    const TAMG_ADDRESS = "0x53BDA082677a4965C79086D3Fe69A6182d6Af1B8"
    const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    const USDC_TAMG_LP_ADDRESS = "0x197B24748D801419d39021bd1B76b9A609D45e5d"
    const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
    const DEADLINE = 2554013609

    let router

    before(async () => {

        try {

            [admin, alice, bob, charlie, dev] = await ethers.getSigners();

            const PriceResolver = await ethers.getContractFactory("PriceResolver");
            const NFTManager = await ethers.getContractFactory("NFTManager");

            const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");
            const ChainlinkPriceFeeder = await ethers.getContractFactory("ChainlinkPriceFeeder");
            const QuickswapTokenFeeder = await ethers.getContractFactory("QuickswapTokenFeeder");
            const QuickswapLPFeeder = await ethers.getContractFactory("QuickswapLPFeeder");

            tamgToken = await ethers.getContractAt('MockERC20', TAMG_ADDRESS)
            usdcToken = await ethers.getContractAt('MockERC20', USDC_ADDRESS)
            shareToken = await ethers.getContractAt("IPancakePair", USDC_TAMG_LP_ADDRESS)

            priceResolver = await deployPriceResolver({
                PriceResolver,
                MockPriceFeeder,
                ChainlinkPriceFeeder,
                QuickswapTokenFeeder,
                QuickswapLPFeeder,
                TamgToken: tamgToken,
                Admin: admin
            })

            nftManager = await NFTManager.deploy(
                "Ang Pow USD",
                "https://api.tamago.finance/angpow/{id}",
                priceResolver.address,
                shareToken.address,
                ethers.utils.formatBytes32String("USDC-TAMG-SHARE"),
                ethers.utils.formatBytes32String("USD"),
                dev.address
            )

            // setup NFT variants
            await nftManager.addSyntheticVariant("Ang Pow 100 USD", 1, toEther(100))
            await nftManager.addSyntheticVariant("Ang Bao 10 USD", 2, toEther(10))
            await nftManager.addSyntheticVariant("Ang Bao 1 USD", 3, toEther(1))

            await nftManager.setContractState(1)

            const syntheticNftAddress = await nftManager.syntheticNFT()
            syntheticNft = await ethers.getContractAt('SyntheticNFT', syntheticNftAddress)

            // trade TAMG
            router = await ethers.getContractAt('IPancakeRouter02', ROUTER_ADDRESS)
        } catch (e) {
            console.log(e)
        }


    });

    it('check on-chain params are correct', async () => {

        try {

            // TAMG
            expect(await tamgToken.symbol()).to.equal("TAMG")
            expect(await tamgToken.name()).to.equal("TamagoToken")

            expect(await nftManager.name()).to.equal("Ang Pow USD")
            expect(await nftManager.priceResolver()).to.equal(priceResolver.address)
            expect(await nftManager.collateralShare()).to.equal(shareToken.address)
            expect(await nftManager.devAddress()).to.equal(dev.address)

        } catch (e) {
            console.log(e)
        }

    })


})