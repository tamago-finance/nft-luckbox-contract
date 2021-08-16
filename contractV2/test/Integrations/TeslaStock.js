const { expect } = require("chai");
const { fromEther, toEther } = require("../Helpers")
const { ethers } = require('hardhat');


let tokenManager
let priceResolver
let baseCollateral
let supportCollateral
let syntheticToken

let admin
let alice
let bob


describe("Tesla Synthetic Tokens", () => {

    let isMainnet = false


    before(async () => {

        try {

            [admin, alice, bob] = await ethers.getSigners();

            const TokenManager = await ethers.getContractFactory("TokenManager");
            const TokenFactory = await ethers.getContractFactory("TokenFactory");
            const ChainlinkPriceFeeder = await ethers.getContractFactory("ChainlinkPriceFeeder");
            const PriceResolver = await ethers.getContractFactory("PriceResolver");
            const MockToken = await ethers.getContractFactory("MockToken");

            const tokenFactory = await TokenFactory.deploy()

            // setup collateral tokens
            baseCollateral = await MockToken.deploy("Binance Coin", "BNB")
            supportCollateral = await MockToken.deploy("USDC", "USDC")

            // setup price feeders
            chainlinkPriceFeeder = await ChainlinkPriceFeeder.deploy(
                "Tesla",
                "0x1ceDaaB50936881B3e449e47e40A2cDAF5576A4a",
                8
            )

            chainlinkPriceFeederCollateral = await ChainlinkPriceFeeder.deploy(
                "BNB",
                "0x14e613AC84a31f709eadbdF89C6CC390fDc9540A",
                8
            )

            priceResolver = await PriceResolver.deploy(
                chainlinkPriceFeeder.address,
                chainlinkPriceFeederCollateral.address,
                toEther(400),
                admin.address
            );

            // setup a minter contract
            tokenManager = await TokenManager.deploy(
                "Synthetic Tesla",
                "sTSLA",
                tokenFactory.address,
                priceResolver.address,
                baseCollateral.address,
                supportCollateral.address,
                admin.address
            )

            const syntheticTokenAddress = await tokenManager.syntheticToken()
            syntheticToken = await ethers.getContractAt('SyntheticToken', syntheticTokenAddress)

            // make it ready
            await tokenManager.connect(admin).setContractState(1)

            if (await chainlinkPriceFeeder.getValue() !== 0) {
                isMainnet = true
            }

        } catch (e) {
            // console.log(e)
        }
    })

    it('mint 10 sTSLA token and redeem all', async () => {
        if (isMainnet) {
            // try to mint 10 sTSLA
            const tokenIn = await tokenManager.estimateTokensIn(  toEther(10))

            // console.log(fromEther(tokenIn[0])) // BNB
            // console.log(fromEther(tokenIn[1])) // USDC

            // funding Alice
            await baseCollateral.transfer(alice.address, toEther("10000"))
            await supportCollateral.transfer(alice.address, toEther("10000"))

            await baseCollateral.connect(alice).approve(tokenManager.address, toEther(100000))
            await supportCollateral.connect(alice).approve(tokenManager.address, toEther(100000))

            // Mint 10 sTSLA
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(10))

            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(10))

            // ensure the ratio is 1.20
            expect( fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("1.2")

            await syntheticToken.connect(alice).approve(tokenManager.address, toEther(10000))

            // Redeem All
            await tokenManager.connect(alice).redeemAll()
            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
        }

    })

    // advanced operations
    it('mint 5 sTSLA + deposit 1000 USDC + redeem ~1 sTSLA + withdraw 2 BNB + mint 2 sTSLA + redeem all', async () => {
        
        if (isMainnet) {
            
            // mint 5 sTSLA
            let tokenIn = await tokenManager.estimateTokensIn( toEther(5))
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(5))

            // deposit 1000 USDC
            await tokenManager.connect(alice).deposit(0 ,  toEther(1000))

            // ratio now should greater than 1.20
            expect( Number(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())) > 1.2 ).to.true

            const tokensOut = await tokenManager.connect(alice).estimateTokensOut( alice.address, toEther("1") , toEther("300") )

            // redeem ~1 sTSLA
            await tokenManager.connect(alice).redeem( toEther("1") , toEther("300"), tokensOut)

            // withdraw 2 BNB
            await tokenManager.connect(alice).withdraw( toEther("2")  , 0 )

            // mint 2 sTSLA
            tokenIn = await tokenManager.estimateTokensIn( toEther(2))
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(2))

            // 5 sTSLA + 2sTSLA - ~1 sTSLA
            expect( Number(fromEther(await syntheticToken.balanceOf(  alice.address ))) > 5  ).to.true

            // Redeem All
            await tokenManager.connect(alice).redeemAll()
            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
        }


    })

})