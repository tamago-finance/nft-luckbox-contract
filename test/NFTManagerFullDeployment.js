const { expect } = require("chai");
const { fromEther, toEther, deployPriceResolverMock, deployPriceResolver } = require("./Helpers")

let priceResolver
let nftManager
let wmaticToken
let usdcToken
let shareToken
let syntheticNft

let admin
let alice
let bob
let charlie
let dev


describe("Full Deployment Ang Pow USD", () => {

    const WMATIC_ADDRESS = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
    const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    const WMATIC_USDC_LP_ADDRESS = "0x6e7a5fafcec6bb1e78bae2a1f0b612012bf14827"
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

            wmaticToken = await ethers.getContractAt('MockERC20', WMATIC_ADDRESS)
            usdcToken = await ethers.getContractAt('MockERC20', USDC_ADDRESS)
            shareToken = await ethers.getContractAt("IPancakePair", WMATIC_USDC_LP_ADDRESS)

            priceResolver = await deployPriceResolver({
                PriceResolver,
                MockPriceFeeder,
                ChainlinkPriceFeeder,
                QuickswapTokenFeeder,
                QuickswapLPFeeder,
                // TamgToken: tamgToken,
                Admin: admin
            })

            nftManager = await NFTManager.deploy(
                "Ang Pow USD",
                "https://api.tamago.finance/angpow/{id}",
                priceResolver.address,
                shareToken.address,
                ethers.utils.formatBytes32String("WMATIC-USDC-SHARE"),
                ethers.utils.formatBytes32String("USD"),
                dev.address
            )

            // setup NFT variants
            await nftManager.addSyntheticVariant("Ang Pow 100 USD", 1, toEther(100))
            await nftManager.addSyntheticVariant("Ang Pow 10 USD", 2, toEther(10))
            await nftManager.addSyntheticVariant("Ang Pow 1 USD", 3, toEther(1))

            await nftManager.setContractState(1)

            const syntheticNftAddress = await nftManager.syntheticNFT()
            syntheticNft = await ethers.getContractAt('SyntheticNFT', syntheticNftAddress)

            // trade USDC
            router = await ethers.getContractAt('IPancakeRouter02', ROUTER_ADDRESS)
        } catch (e) {
            console.log(e)
        }


    });

    it('Mint/redeem Ang Bao NFTs', async () => {

        try {
            // buy USDC /w 1000 Matic
            const minOutput = await router.getAmountsOut(toEther(1000), [await router.WETH(), USDC_ADDRESS])

            await router.swapExactETHForTokens(minOutput[1], [await router.WETH(), USDC_ADDRESS], admin.address, DEADLINE, { value: toEther(1000) })

            const usdcBalance = await usdcToken.balanceOf(admin.address)
            expect(Number(ethers.utils.formatUnits(usdcBalance, 6)) > 1000).to.true

            // wrap WMATIC /w 1000 Matic
            await wmaticToken.deposit( toEther(1000) , { value : toEther(1000)})

            const wmaticBalance = await wmaticToken.balanceOf(admin.address)
            expect(Number(ethers.utils.formatUnits(wmaticBalance, 18)) === 1000).to.true

            await wmaticToken.approve(nftManager.address, ethers.constants.MaxUint256)
            await usdcToken.approve(nftManager.address, ethers.constants.MaxUint256)

            const inputs = await nftManager.estimateMint(1, 3)

            // mint x3 Ang Bao NFTs
            await nftManager.mint(1, 3, inputs[0], inputs[1])

            // verify
            expect((await syntheticNft.balanceOf(admin.address, 2))).to.equal(3)

            let variantInfo = await nftManager.syntheticVariants(1)

            expect(variantInfo.totalOutstanding).to.equal(toEther(30))
            expect((variantInfo.totalIssued)).to.equal(3)
            expect(variantInfo.totalRawCollateral).to.not.equal(0)
            expect(await nftManager.totalRawCollateral()).to.not.equal(0)

            expect(Number(fromEther(await nftManager.globalCollatelizationRatio())) > 0.9).to.true
            expect(Number(fromEther(await nftManager.variantCollatelizationRatio(1))) > 0.9).to.true

            // mint x1 NFT without collaterals to bring down the CR
            await nftManager.forceMint(1, 0, 2)

            expect(0.8 > Number(fromEther(await nftManager.variantCollatelizationRatio(1)))).to.true

            await syntheticNft.setApprovalForAll(nftManager.address, true)

            await nftManager.redeem(1, 2, 0, 0)

            expect((await syntheticNft.balanceOf(admin.address, 2))).to.equal(3)
        } catch (e) {
            console.log(e)
        }

    })


})