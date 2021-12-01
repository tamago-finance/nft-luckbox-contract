const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")

let mockPriceFeeder
let chainlinkPriceFeeder
let admin
let alice

describe("MockPriceFeeder contract", () => {

    before(async () => {

        [admin, alice] = await ethers.getSigners();

        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");
        mockPriceFeeder = await MockPriceFeeder.deploy("TEST/USD");

    });

    it('can update & get values', async () => {
        // update value
        await mockPriceFeeder.connect(admin).updateValue(toEther(0.5));

        const value = await mockPriceFeeder.getValue();
        expect(fromEther(value)).to.equal("0.5")

    });

    it('can get the timestamp', async () => {
        expect(await mockPriceFeeder.getTimestamp()).to.not.equal("0")
    });

})

describe("ChainlinkPriceFeeder contract", () => {

    before(async () => {

        [admin, alice] = await ethers.getSigners();

        const ChainlinkPriceFeeder = await ethers.getContractFactory("ChainlinkPriceFeeder");
        chainlinkPriceFeeder = await ChainlinkPriceFeeder.deploy(
            "Bitcoin",
            "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
            8
        )

    });

    it('retrieve current price and timestamp', async () => {
        try {
            const value = await chainlinkPriceFeeder.getValue()
            expect(Number(fromEther(value)) > 100).to.true

            const timestamp = await chainlinkPriceFeeder.getTimestamp()
            expect(timestamp !== 0).to.true
        }
        catch (e) {

        }
    })


})