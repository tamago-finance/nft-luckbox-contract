const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")
const {  ethers } = require('hardhat');


let tokenManager
let priceResolver
let baseCollateral
let supportCollateral
let syntheticToken

let admin
let alice
let bob


describe("TokenManager contract", () => {

    before(async () => {


        [admin, alice, bob] = await ethers.getSigners();

        const TokenManager = await ethers.getContractFactory("TokenManager");
        const TokenFactory = await ethers.getContractFactory("TokenFactory");
        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");
        const PriceResolver = await ethers.getContractFactory("PriceResolver");
        const MockToken = await ethers.getContractFactory("MockToken");

        const tokenFactory = await TokenFactory.deploy()

        // setup collateral tokens
        baseCollateral = await MockToken.deploy("Tamago Token", "TAMG")
        supportCollateral = await MockToken.deploy("USDC", "USDC")

        // setup price feeder contracts
        const priceFeeder = await MockPriceFeeder.deploy("ETH/USD");
        const priceFeederCollateral = await MockPriceFeeder.deploy("TAMG/USD");

        // update value
        await priceFeeder.connect(admin).updateValue(toEther(2500));
        await priceFeederCollateral.connect(admin).updateValue(toEther(0.5));
        await priceFeederCollateral.connect(admin).setAveragePrice(toEther(0.5));

        priceResolver = await PriceResolver.deploy(
            priceFeeder.address,
            priceFeederCollateral.address,
            toEther(0.5),
            admin.address
        );

        tokenManager = await TokenManager.deploy(
            "Synthetic ETH",
            "sETH",
            tokenFactory.address,
            priceResolver.address,
            baseCollateral.address,
            supportCollateral.address,
            admin.address
        )

        const syntheticTokenAddress = await tokenManager.syntheticToken()
        syntheticToken = await ethers.getContractAt('SyntheticToken', syntheticTokenAddress)
    })


    it('change the contract state to be ready', async () => {

        expect(await tokenManager.state()).to.equal(0)

        await tokenManager.connect(admin).setContractState(1)
        expect(await tokenManager.state()).to.equal(1)

    })

    it('validate all initial values are correct', async () => {

        expect(await tokenManager.name()).to.equal("Synthetic ETH Token Manager")
        expect(await syntheticToken.name()).to.equal("Synthetic ETH")
        expect(await syntheticToken.symbol()).to.equal("sETH")

        expect(await tokenManager.priceResolver()).to.equal(priceResolver.address)
        expect(await tokenManager.baseCollateralToken()).to.equal(baseCollateral.address)
        expect(await tokenManager.supportCollateralToken()).to.equal(supportCollateral.address)

    })

    it('helper functions return correct results', async () => {

        // 1ETH = 1500 USD + (2000 TAMG * 0.5 TAMG / USD ) 
        expect(await tokenManager.getCollateralizationRatio(toEther(2000), toEther(1500), toEther(1))).to.equal(toEther(1))

        expect(fromEther(await tokenManager.getMintRatio())).to.equal("0.5")
        expect(fromEther(await tokenManager.getSyntheticPrice())).to.equal("2500.0")
        expect(fromEther(await tokenManager.getBaseCollateralPrice())).to.equal("0.5")
        expect(fromEther(await tokenManager.getSupportCollateralPrice())).to.equal("1.0")

        expect(fromEther(await tokenManager.liquidationRatio())).to.equal("1.2")
        expect(fromEther(await tokenManager.mintFee())).to.equal("0.0")
        expect(fromEther(await tokenManager.redeemFee())).to.equal("0.0")

    })

    it('mint 1 synthetic token and redeem all', async () => {

        const tokenIn = await tokenManager.estimateTokensIn(  toEther(1))

        expect(fromEther(tokenIn[0])).to.equal("3000.0") // 3000 TAMG
        expect(fromEther(tokenIn[1])).to.equal("1500.0") // 1500 USDC

        // funding Alice
        await baseCollateral.transfer(alice.address, toEther("10000"))
        await supportCollateral.transfer(alice.address, toEther("10000"))

        expect(await baseCollateral.balanceOf(alice.address)).to.equal(toEther(10000))
        expect(await supportCollateral.balanceOf(alice.address)).to.equal(toEther(10000))

        await baseCollateral.connect(alice).approve(tokenManager.address, toEther(100000))
        await supportCollateral.connect(alice).approve(tokenManager.address, toEther(100000))

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(1))

        expect(await baseCollateral.balanceOf(alice.address)).to.equal(toEther(7000))
        expect(await supportCollateral.balanceOf(alice.address)).to.equal(toEther(8500))
        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(1))

        // Check user states
        const positionData = await tokenManager.connect(alice).myTokensCollateral()
        expect(fromEther(positionData[0])).to.equal("3000.0")
        expect(fromEther(positionData[1])).to.equal("1500.0")

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("1.2")
        expect(fromEther(await tokenManager.connect(alice).myTokensOutstanding())).to.equal("1.0")

        // Check global states
        expect(await tokenManager.tokenOutstanding()).to.equal(toEther(1))

        const depositedCollateral = await tokenManager.totalRawCollateral()
        expect(depositedCollateral[0]).to.equal(toEther(3000))
        expect(depositedCollateral[1]).to.equal(toEther(1500))

        expect(await tokenManager.totalMinter()).to.equal(1)
        expect(await tokenManager.minterAddress(0)).to.equal(alice.address)
        expect(await tokenManager.isMinter(alice.address)).to.equal(true)

        await syntheticToken.connect(alice).approve(tokenManager.address, toEther(10000))

        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await baseCollateral.balanceOf(alice.address)).to.equal(toEther(10000))
        expect(await supportCollateral.balanceOf(alice.address)).to.equal(toEther(10000))
        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))

    })

    it('double mint and redeem all', async () => {

        let tokenIn = await tokenManager.estimateTokensIn( toEther(1))

        expect(fromEther(tokenIn[0])).to.equal("3000.0") // 3000 TAMG
        expect(fromEther(tokenIn[1])).to.equal("1500.0") // 1500 USDC

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(1))

        tokenIn = await tokenManager.estimateTokensIn(toEther(0.5))

        // Mint another 0.5 Synthetic
        await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(0.5))

        expect(fromEther(await tokenManager.connect(alice).myTokensOutstanding())).to.equal("1.5")
        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("1.2")

        expect(fromEther(await syntheticToken.balanceOf(alice.address))).to.equal("1.5")

        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
    })

    it('mint from existing position and redeem all', async () => {

        let tokenIn = await tokenManager.estimateTokensIn( toEther(1))

        // Mint 1 Synthetic at 300%
        await tokenManager.connect(alice).mint(toEther(Number(fromEther(tokenIn[0])) * 2.5), toEther(Number(fromEther(tokenIn[1])) * 2.5), toEther(1))

        tokenIn = await tokenManager.estimateTokensIn(toEther(3))

        // Mint another 0.25 Synthetic from existing position
        await tokenManager.connect(alice).mint(0, 0, toEther(0.25))

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("2.4")
        expect(fromEther(await syntheticToken.balanceOf(alice.address))).to.equal("1.25")

        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
    })


    it('mint 1 ETH at 300% and redeem 0.5 ETH back', async () => {

        let tokenIn = await tokenManager.estimateTokensIn( toEther(1))

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(toEther(Number(fromEther(tokenIn[0])) * 2.5), toEther(Number(fromEther(tokenIn[1])) * 2.5), toEther(1))

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("3.0")

        const collaterals = await tokenManager.connect(alice).myTokensCollateral()

        expect( fromEther( collaterals[0] )).to.equal( "7500.0")
        expect( fromEther( collaterals[1] )).to.equal( "3750.0")

        const tokensOut = await tokenManager.connect(alice).estimateTokensOut( alice.address, toEther("2000") , toEther("1000") )

        expect( fromEther(tokensOut)).to.equal("0.266666666666666667")
        
        // Redeem 0.26 Synthetic Tokens for 2000 TAMG and 1000 USDC
        await tokenManager.connect(alice).redeem( toEther("2000") , toEther("1000"), tokensOut)

        expect( fromEther( await syntheticToken.balanceOf(alice.address) ) ).to.equal("0.733333333333333333")
        expect( fromEther( await baseCollateral.balanceOf( alice.address ) )).to.equal("4500.0")
        expect( fromEther( await supportCollateral.balanceOf( alice.address ) )).to.equal("7250.0")
        expect( fromEther( await tokenManager.connect(alice).myCollateralizationRatio() )).to.equal("3.000000000000000001")


        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
    })

    it('mint 1 ETH at 300% and deposit more collateral', async () => {
        let tokenIn = await tokenManager.estimateTokensIn(  toEther(1))

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(toEther(Number(fromEther(tokenIn[0])) * 2.5), toEther(Number(fromEther(tokenIn[1])) * 2.5), toEther(1))

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("3.0")

        await tokenManager.connect(alice).deposit( toEther("2000")  , toEther("1000"))
    
        expect( fromEther( await tokenManager.connect(alice).myCollateralizationRatio() )).to.equal("3.8")

        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
    })
    
    it('mint 1 ETH at 300% and withdraw some collateral', async () => {
        let tokenIn = await tokenManager.estimateTokensIn(  toEther(1))

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(toEther(Number(fromEther(tokenIn[0])) * 2.5), toEther(Number(fromEther(tokenIn[1])) * 2.5), toEther(1))

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("3.0")

        await tokenManager.connect(alice).withdraw( toEther("2000")  , toEther("1000"))

        expect( fromEther( await tokenManager.connect(alice).myCollateralizationRatio() )).to.equal("2.2")
    
        // Redeem All
        await tokenManager.connect(alice).redeemAll()

        expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
    })

    it('able to update price resolver contract', async () => {

        const currentAddress = await tokenManager.priceResolver()

        const DUMMY = "0xBab2fBa60058A8af598c041eff79A6BbC8A39D92"

        await tokenManager.setPriceResolver(DUMMY)

        // should not be the same
        expect(  await tokenManager.priceResolver() ).to.not.equal(currentAddress)

        // update it back
        await tokenManager.setPriceResolver(currentAddress)

        expect(  await tokenManager.priceResolver() ).to.equal(currentAddress)

        // should be failed if Alice try to do it
        try {
            await tokenManager.connect(alice).setPriceResolver(DUMMY)
        } catch (e) {
            expect( (e.message).indexOf("caller is not the owner") !== -1 ).to.true
        }

    })

    // TODO: Do complex tests
    

})