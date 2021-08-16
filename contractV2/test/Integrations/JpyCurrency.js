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
            baseCollateral = await MockToken.deploy("Matic Coin", "MATIC")
            supportCollateral = await MockToken.deploy("USDC", "USDC")

            // setup price feeders
            chainlinkPriceFeeder = await ChainlinkPriceFeeder.deploy(
                "JPY",
                "0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3",
                8
            )

            chainlinkPriceFeederCollateral = await ChainlinkPriceFeeder.deploy(
                "MATIC",
                "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676",
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
                "Synthetic JPY",
                "sJPY",
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


    it('mint 10000 sJPY token and redeem all', async () => {
        if (isMainnet) {

            const tokenIn = await tokenManager.estimateTokensIn(toEther(10000))

            // console.log(fromEther(tokenIn[0])) // MATIC
            // console.log(fromEther(tokenIn[1])) // USDC

            // funding Alice
            await baseCollateral.transfer(alice.address, toEther("10000"))
            await supportCollateral.transfer(alice.address, toEther("10000"))

            await baseCollateral.connect(alice).approve(tokenManager.address, toEther(1000000))
            await supportCollateral.connect(alice).approve(tokenManager.address, toEther(1000000))

            // Mint 10000 sTSLA
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(10000))

            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(10000))

            // ensure the ratio is 1.20
            expect(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())).to.equal("1.2")

            await syntheticToken.connect(alice).approve(tokenManager.address, toEther(1000000))

            // Redeem All
            await tokenManager.connect(alice).redeemAll()
            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
        }
    })


    // advanced operations
    it('mint 100000 sJPY + deposit 500 USDC + redeem ~10000 sJPY + withdraw 10 MATIC + mint 2000 sJPY + redeem all', async () => {

        if (isMainnet) {

            // mint 100000 sJPY
            let tokenIn = await tokenManager.estimateTokensIn(toEther(100000))
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(100000))

            // deposit 500 USDC
            await tokenManager.connect(alice).deposit(0, toEther(500))

            // ratio now should greater than 1.20
            expect(Number(fromEther(await tokenManager.connect(alice).myCollateralizationRatio())) > 1.2).to.true

            const tokensOut = await tokenManager.connect(alice).estimateTokensOut(alice.address, toEther("45"), toEther("40"))

            // redeem ~10000 sTSLA
            await tokenManager.connect(alice).redeem(toEther("45"), toEther("40"), tokensOut)

            // withdraw 10 MATIC
            await tokenManager.connect(alice).withdraw(toEther("10"), 0)

            // mint 2000 sJPY
            tokenIn = await tokenManager.estimateTokensIn(toEther(2000))
            await tokenManager.connect(alice).mint(tokenIn[0], tokenIn[1], toEther(2000))

            // 100000 sJPY + 2000 sJPY - ~10000 sJPY
            expect(Number(fromEther(await syntheticToken.balanceOf(alice.address))) > 80000).to.true

            // Redeem All
            await tokenManager.connect(alice).redeemAll()
            expect(await syntheticToken.balanceOf(alice.address)).to.equal(toEther(0))
        }


    })


})