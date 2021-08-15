const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")

let priceResolver
let priceFeeder
let priceFeederCollateral
let admin
let alice

describe("PriceResolver contract", () => {

    before(async () => {

        [admin, alice] = await ethers.getSigners();

        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");
        priceFeeder = await MockPriceFeeder.deploy("ETH/USD");

        priceFeederCollateral = await MockPriceFeeder.deploy("BNB/USD");

        // update value
        await priceFeeder.connect(admin).updateValue(toEther(2500));
        await priceFeederCollateral.connect(admin).updateValue(toEther(20));
        await priceFeederCollateral.connect(admin).setAveragePrice(toEther(20));

        // setup price resolver contract
        const PriceResolver = await ethers.getContractFactory("PriceResolver")
        priceResolver = await PriceResolver.deploy(
            priceFeeder.address,
            priceFeederCollateral.address,
            toEther(20),
            admin.address
        );

    });

    it('all initial values are correct', async () => {

        expect(fromEther(await priceResolver.getEmergencyReferencePrice())).to.equal("20.0")
        expect((await priceResolver.priceFeeder())).to.equal(priceFeeder.address)
        expect((await priceResolver.priceFeederCollateral())).to.equal(priceFeederCollateral.address)

    })

    it('both price feeder contracts return correct value', async () => {

        const assetPrice = await priceFeeder.getValue()
        const collateralPrice = await priceFeederCollateral.getValue()

        expect(fromEther(assetPrice)).to.equal("2500.0")
        expect(fromEther(collateralPrice)).to.equal("20.0")

        expect(await priceResolver.getCurrentPrice()).to.equal(assetPrice)
        expect(await priceResolver.getCurrentPriceCollateral()).to.equal(collateralPrice)
    })

    it('dev can update the emergency value', async () => {

        await priceResolver.connect(admin).setEmergencyPrice(toEther(25));
        expect(fromEther(await priceResolver.getEmergencyReferencePrice())).to.equal("25.0")

    })

    it('return the correct mint ratio', async () => {

        let rawRatio = await priceResolver.getRawRatio()
        expect(fromEther(rawRatio)).to.equal("0.5")

        // make it to be reaching the cap
        await priceFeederCollateral.connect(admin).setAveragePrice(toEther(10));
        rawRatio = await priceResolver.getRawRatio()
        expect(fromEther(rawRatio)).to.equal("1.0")

        let currentRatio = await priceResolver.getCurrentRatio()
        expect(fromEther(currentRatio)).to.equal("0.8")

        expect( await priceResolver.isBullMarket() ).to.true

        // turn the market into bear
        await priceFeederCollateral.connect(admin).setAveragePrice(toEther(1000));
        
        currentRatio = await priceResolver.getCurrentRatio()
        expect(fromEther(currentRatio)).to.equal("0.2")

        expect( await priceResolver.isBullMarket() ).to.false
    })


})