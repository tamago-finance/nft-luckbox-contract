const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")
const {  ethers } = require('hardhat');


let tokenManager
let priceResolver
let baseCollateral
let supportCollateral
let syntheticToken
let priceFeederCollateral

let admin
let alice
let bob

describe("TokenManager contract /w Liquidation", () => {

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
        priceFeederCollateral = await MockPriceFeeder.deploy("TAMG/USD");

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

        // make the contract ready
        await tokenManager.connect(admin).setContractState(1)
    })


    it('Alice mints 1 synthetic token, Bob liquidates Alice position', async () => {

        let tokenIn = await tokenManager.estimateTokensIn(  toEther(1))

        expect(fromEther(tokenIn[0])).to.equal("3000.0") // 3000 TAMG
        expect(fromEther(tokenIn[1])).to.equal("1500.0") // 1500 USDC

        // funding Alice
        await baseCollateral.transfer(alice.address, toEther("10000"))
        await supportCollateral.transfer(alice.address, toEther("10000"))

        // funding Bob
        await baseCollateral.transfer(bob.address, toEther("10000"))
        await supportCollateral.transfer(bob.address, toEther("10000"))

        // making approvals
        await baseCollateral.connect(alice).approve(tokenManager.address, toEther(100000))
        await supportCollateral.connect(alice).approve(tokenManager.address, toEther(100000))
        await baseCollateral.connect(bob).approve(tokenManager.address, toEther(100000))
        await supportCollateral.connect(bob).approve(tokenManager.address, toEther(100000))

        // Mint 1 Synthetic
        await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(1)) 
        await tokenManager.connect(bob).mint( toEther(6000), toEther(3000) , toEther(2))

        expect( await syntheticToken.balanceOf( alice.address) ).to.equal( toEther(1) )
        expect( await syntheticToken.balanceOf( bob.address) ).to.equal( toEther(2) )

        expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("1.2")

        expect( (await tokenManager.checkLiquidate(alice.address))[0]).to.false

        // decrease TAMG token price by 50%
        await priceFeederCollateral.connect(admin).updateValue(toEther(0.25));

        expect( await tokenManager.collateralizationRatioOf( alice.address ) ).to.equal( toEther(0.9))

        const liquidationData = await tokenManager.checkLiquidate(alice.address)
        expect( liquidationData[0] ).to.true
        expect( liquidationData[1] ).to.equal( toEther(0.81)) // use 0.81 synths to liquidate

        expect( fromEther( await baseCollateral.balanceOf( bob.address) )).to.equal( "4000.0")
        expect( fromEther( await supportCollateral.balanceOf( bob.address) )).to.equal("7000.0")

        // liquidate Alice's position
        await syntheticToken.connect(bob).approve(tokenManager.address, toEther(100))
        await tokenManager.connect(bob).liquidate( alice.address , toEther(1) )

        const positionData = await tokenManager.tokensCollateralOf(alice.address)
        expect(fromEther(positionData[0])).to.equal("0.0")
        expect(fromEther(positionData[1])).to.equal("0.0")

        // ensure Bob took penalties 
        expect( fromEther( await baseCollateral.balanceOf( bob.address) )).to.equal( "7000.0")
        expect( fromEther( await supportCollateral.balanceOf( bob.address) )).to.equal("8500.0")

    })


    // TODO: Do complex scenarios

})