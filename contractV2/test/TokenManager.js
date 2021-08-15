const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")
const { deployments, ethers } = require('hardhat');


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

        baseCollateral = await MockToken.deploy("Tamago Token", "TAMG")
        supportCollateral = await MockToken.deploy("USDC", "USDC")

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




})