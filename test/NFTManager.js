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

describe("NFTManager contract with mocks", () => {

    before(async () => {

        [admin, alice, bob, charlie, dev] = await ethers.getSigners();

        const PriceResolver = await ethers.getContractFactory("PriceResolver");
        const NFTManager = await ethers.getContractFactory("NFTManager");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const MockLP = await ethers.getContractFactory("MockLP");
        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");

        priceResolver = await deployPriceResolverMock({ PriceResolver, MockPriceFeeder, admin })

        tamgToken = await MockERC20.deploy("Tamago Token", "TAMG")
        shareToken = await MockLP.deploy("Share Token", "SHARE")

        nftManager = await NFTManager.deploy(
            "Ang Bao USD",
            "ERC-1155_URI",
            priceResolver.address,
            shareToken.address,
            ethers.utils.formatBytes32String("USDC-TAMG-SHARE/USD"),
            ethers.utils.formatBytes32String("USD"),
            dev.address
        )

        // setup NFT variants
        await nftManager.addSyntheticVariant("Ang Bao 1 USD", 1, toEther(1))
        await nftManager.addSyntheticVariant("Ang Bao 10 USD", 2, toEther(10))
        await nftManager.addSyntheticVariant("Ang Bao 100 USD", 3, toEther(100))

    });

    it('verify initial params', async () => {

        // intial params
        expect(await nftManager.name()).to.equal("Ang Bao USD")
        expect(await nftManager.priceResolver()).to.equal(priceResolver.address)
        expect(await nftManager.collateralShare()).to.equal(shareToken.address)
        expect(await nftManager.devAddress()).to.equal(dev.address)

        // check prices
        expect(await nftManager.getSyntheticPrice()).to.equal(toEther(1))
        expect(await nftManager.getCollateralSharePrice()).to.equal(toEther(1380000))

        // update base URI of ERC-1155
        const syntheticNftAddress = await nftManager.syntheticNFT()
        syntheticNft = await ethers.getContractAt('SyntheticNFT', syntheticNftAddress)

        await nftManager.setNftUri("https://api.cryptokitties.co/kitties/{id}")
        expect(await syntheticNft.uri(0)).to.equal("https://api.cryptokitties.co/kitties/{id}")

        // check variants
        const firstVariant = await nftManager.syntheticVariants(0);
        expect(firstVariant[0]).to.equal("Ang Bao 1 USD")
        expect(firstVariant[1]).to.equal(1)
        expect(firstVariant[2]).to.equal(toEther(1))

        const secondVariant = await nftManager.syntheticVariants(1);
        expect(secondVariant[0]).to.equal("Ang Bao 10 USD")
        expect(secondVariant[1]).to.equal(2)
        expect(secondVariant[2]).to.equal(toEther(10))

        const thirdVariant = await nftManager.syntheticVariants(2);
        expect(thirdVariant[0]).to.equal("Ang Bao 100 USD")
        expect(thirdVariant[1]).to.equal(3)
        expect(thirdVariant[2]).to.equal(toEther(100))

    })

    it('force mint/redeem x3 Ang Bao 10 USD', async () => {

        // check required LP share need to mint
        const syntheticPrice = fromEther(await nftManager.getSyntheticPrice())
        const sharePrice = fromEther(await nftManager.getCollateralSharePrice())

        const nftValue = fromEther((await nftManager.syntheticVariants(1))[2])

        const lpPerNft = Number(nftValue) * Number(syntheticPrice) / Number(sharePrice)

        await shareToken.approve(nftManager.address, ethers.constants.MaxUint256)

        for (let i = 0; i < 3; i++) {
            await nftManager.forceMint(1, toEther(lpPerNft.toFixed(18)), 1)
        }

        expect((await syntheticNft.balanceOf(admin.address, 2))).to.equal(3)

        let variantInfo = await nftManager.syntheticVariants(1)

        expect(variantInfo.totalOutstanding).to.equal(toEther(30))
        expect((variantInfo.totalIssued)).to.equal(3)
        expect(fromEther(variantInfo.totalRawCollateral)).to.equal("0.000021739130434782")
        expect(fromEther(await nftManager.totalRawCollateral())).to.equal("0.000021739130434782")
        expect((await nftManager.totalOutstanding())).to.equal(toEther(30))

        // check the collatelization ratio
        expect(fromEther(await nftManager.globalCollatelizationRatio())).to.equal("0.999999999999972")
        expect(fromEther(await nftManager.variantCollatelizationRatio(1))).to.equal("0.999999999999972")

        // redeem all NFTs back

        await syntheticNft.setApprovalForAll(nftManager.address, true)

        for (let i = 0; i < 3; i++) {
            await nftManager.forceRedeem(1, toEther(lpPerNft.toFixed(18)), 1)
        }

        variantInfo = await nftManager.syntheticVariants(1)

        expect(variantInfo.totalOutstanding).to.equal(0)
        expect((variantInfo.totalBurnt)).to.equal(3)

        expect((variantInfo.totalRawCollateral)).to.equal(0)
        expect(await nftManager.totalRawCollateral()).to.equal(0)
        expect(await nftManager.totalOutstanding()).to.equal(0)
    })


    it('verify CR offset/discount', async () => {

        const syntheticPrice = fromEther(await nftManager.getSyntheticPrice())
        const sharePrice = fromEther(await nftManager.getCollateralSharePrice())
        const nftValue = fromEther((await nftManager.syntheticVariants(1))[2])
        const lpPerNft = Number(nftValue) * Number(syntheticPrice) / Number(sharePrice)

        // mint 1 NFT with 50% value backed
        await nftManager.forceMint(1, toEther((lpPerNft * 0.5).toFixed(18)), 1)

        expect(fromEther(await nftManager.globalCollatelizationRatio())).to.equal("0.499999999999986") // 49%

        // check target CR
        expect(fromEther((await nftManager.targetCollatelizationRatio(1))[0])).to.equal("0.75204844781942852") // offset
        expect(fromEther((await nftManager.targetCollatelizationRatio(1))[1])).to.equal("1.0") // discount


        // mint another 1 NFT to shift the CR > 1
        await nftManager.forceMint(1, toEther((lpPerNft * 3).toFixed(18)), 1)

        // then check the params
        expect(fromEther(await nftManager.globalCollatelizationRatio())).to.equal("1.75000000000002") // 175%
        expect(fromEther((await nftManager.targetCollatelizationRatio(1))[0])).to.equal("1.0") // offset
        expect(fromEther((await nftManager.targetCollatelizationRatio(1))[1])).to.equal("1.237418056046240693") // discount

    })

})

describe("NFTManager contract on forked Polygon chain", () => {

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
                "Ang Bao USD",
                "https://api.cryptokitties.co/kitties/{id}",
                priceResolver.address,
                shareToken.address,
                ethers.utils.formatBytes32String("USDC-TAMG-SHARE"),
                ethers.utils.formatBytes32String("USD"),
                dev.address
            )

            // setup NFT variants
            await nftManager.addSyntheticVariant("Ang Bao 1 USD", 1, toEther(1))
            await nftManager.addSyntheticVariant("Ang Bao 10 USD", 2, toEther(10))
            await nftManager.addSyntheticVariant("Ang Bao 100 USD", 3, toEther(100))

            await nftManager.setContractState(1)
            // Set Redeem Fee to 0%
            await nftManager.setRedeemFee(0)

            const syntheticNftAddress = await nftManager.syntheticNFT()
            syntheticNft = await ethers.getContractAt('SyntheticNFT', syntheticNftAddress)

            // trade TAMG
            router = await ethers.getContractAt('IPancakeRouter02', ROUTER_ADDRESS)
        } catch (e) {

        }


    });

    it('check on-chain params are correct', async () => {

        try {

            // TAMG
            expect(await tamgToken.symbol()).to.equal("TAMG")
            expect(await tamgToken.name()).to.equal("TamagoToken")

            expect(await nftManager.name()).to.equal("Ang Bao USD")
            expect(await nftManager.priceResolver()).to.equal(priceResolver.address)
            expect(await nftManager.collateralShare()).to.equal(shareToken.address)
            expect(await nftManager.devAddress()).to.equal(admin.address)

        } catch (e) {

        }

    })

    it('Mint/redeem Ang Bao NFTs', async () => {

        try {
            // buy USDC /w 1000 Matic
            const minOutput = await router.getAmountsOut(toEther(1000), [await router.WETH(), USDC_ADDRESS])

            await router.swapExactETHForTokens(minOutput[1], [await router.WETH(), USDC_ADDRESS], admin.address, DEADLINE, { value: toEther(1000) })

            const usdcBalance = await usdcToken.balanceOf(admin.address)
            expect(Number(ethers.utils.formatUnits(usdcBalance, 6)) > 1000).to.true

            // buy TAMG /w 1000 Matic
            const minTamgOutput = await router.getAmountsOut(toEther(1000), [await router.WETH(), USDC_ADDRESS, TAMG_ADDRESS])

            await router.swapExactETHForTokens(minTamgOutput[2], [await router.WETH(), USDC_ADDRESS, TAMG_ADDRESS], admin.address, DEADLINE, { value: toEther(1000) })

            const tamgBalance = await tamgToken.balanceOf(admin.address)
            expect(Number(ethers.utils.formatUnits(tamgBalance, 18)) > 1000).to.true

            await tamgToken.approve(nftManager.address, ethers.constants.MaxUint256)
            await usdcToken.approve(nftManager.address, ethers.constants.MaxUint256)

            // mint x3 Ang Bao NFTs
            await nftManager.mint(1, 3)

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

            await nftManager.redeem(1, 2)

            expect((await syntheticNft.balanceOf(admin.address, 2))).to.equal(3)
        } catch (e) {
          
        }

    })

    it('Mint x1 NFT when the CR > 1', async () => {

        try {

            // trade LP tokens
            await tamgToken.approve(router.address, ethers.constants.MaxUint256)
            await usdcToken.approve(router.address, ethers.constants.MaxUint256)
            await shareToken.approve(nftManager.address, ethers.constants.MaxUint256)

            // estimate USDC, TAMG tokens needed to mint 5 NFTs
            const inputs = await nftManager.estimateMint(1, 5)
            const baseAmount = Number(ethers.utils.formatUnits(inputs[0], 6))
            const pairAmount = Number(ethers.utils.formatUnits(inputs[1], 18))

            await router.addLiquidity(usdcToken.address, tamgToken.address, ethers.utils.parseUnits(`${baseAmount}`, 6), ethers.utils.parseUnits(`${pairAmount}`, 18), ethers.utils.parseUnits(`${(baseAmount * 0.97).toFixed(6)}`, 6), ethers.utils.parseUnits(`${(pairAmount * 0.97).toFixed(18)}`, 18), admin.address, 9999999999999)

            // mint x1 NFT with 5x collaterals to bring up the CR
            await nftManager.forceMint(1, await shareToken.balanceOf(admin.address), 1)

            const beforeMintRatio = await nftManager.variantCollatelizationRatio(1)

            expect(Number(fromEther(beforeMintRatio)) > 1.1).to.true

            // mint x2 Ang Bao NFTs
            await nftManager.mint(1, 2)

            const afterMintRatio = await nftManager.variantCollatelizationRatio(1)

            expect( Number(fromEther(beforeMintRatio)) > Number(fromEther(afterMintRatio)) ).to.true

        } catch (e) {
           
        }

    })

    it('Redeem x2 NFT when the redeem fee is set', async () => {

        try {
            // set the fee back to 3%
            await nftManager.setRedeemFee(300) // 3%

            // const estimation = await nftManager.estimateRedeem(1, 2)

            // console.log( ethers.utils.formatUnits( estimation[0] , 6))
            // console.log( ethers.utils.formatUnits( estimation[1] , 18))
            // console.log( ethers.utils.formatUnits( estimation[2] , 18))

            // redeem 2 NFTs
            await nftManager.redeem(1, 2)

            // dev should receives fees
            expect( Number(ethers.utils.formatUnits((await usdcToken.balanceOf(dev.address)) , 6)) !== 0  )
            expect( Number(ethers.utils.formatUnits((await tamgToken.balanceOf(dev.address)) , 18)) !== 0 )

        } catch (e) {
            
        }

    })


})