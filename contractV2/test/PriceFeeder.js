const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")

let chainlinkPriceFeeder
let priceFeeder
let mockPriceFeeder
let admin
let alice


describe("MockPriceFeeder contract", () => {


    before(async () => {

        [admin, alice] = await ethers.getSigners();

        const MockPriceFeeder = await ethers.getContractFactory("MockPriceFeeder");
        priceFeeder = await MockPriceFeeder.deploy("TEST/USD");

    });

    it('can update values', async () => {
        // update value
        await priceFeeder.connect(admin).updateValue( toEther(0.5) );

        const value = await priceFeeder.getValue();
        expect( fromEther(value) ).to.equal("0.5")

        // update past value
        await priceFeeder.connect(admin).setPastValue( toEther(0.7) );
        expect( fromEther( (await priceFeeder.getPastValue(0))[0] ) ).to.equal("0.7")

        // update avg. price
        await priceFeeder.connect(admin).setAveragePrice( toEther(0.9) );
        expect( fromEther( (await priceFeeder.getAveragePrice(0))[0] ) ).to.equal("0.9")

    });

    it('can get the timestamp', async () => {
        expect(  await priceFeeder.getTimestamp() ).to.not.equal("0")
    });

})




// Provide an archive node URL at hardhat.config.js to run this file. 

// describe("ChainlinkPriceFeeder contract", () => {

//     let isMainnet = false

//     before(async () => {

//         try {

//             [admin, alice] = await ethers.getSigners();

//             const ChainlinkPriceFeeder = await ethers.getContractFactory("ChainlinkPriceFeeder");

//             chainlinkPriceFeeder = await ChainlinkPriceFeeder.deploy(
//                 "Bitcoin",
//                 "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
//                 8
//             )

//             if (await chainlinkPriceFeeder.getValue() !== 0) {
//                 isMainnet = true
//             }

//         } catch (e) {
//             // console.log(e)
//         }
//     })

//     it('retrieve current price and timestamp', async () => {
//         if (isMainnet) {
//             const value = await chainlinkPriceFeeder.getValue()
//             expect(Number(fromEther(value)) > 100).to.true

//             const timestamp = await chainlinkPriceFeeder.getTimestamp()
//             expect(timestamp !== 0).to.true
//         }
//     })

//     it('retrive 30/60/90/120 days average prices ', async () => {
//         if (isMainnet) {
//             // 30 days
//             const avg30 = await chainlinkPriceFeeder.getAveragePrice(30)
//             expect(fromEther(avg30[0]) !== "0").to.true
//             // 60 days
//             const avg60 = await chainlinkPriceFeeder.getAveragePrice(60)
//             expect(fromEther(avg60[0]) !== "0").to.true
//             // 90 days
//             const avg90 = await chainlinkPriceFeeder.getAveragePrice(90)
//             expect(fromEther(avg90[0]) !== "0").to.true
//             //  120 days
//             const avg120 = await chainlinkPriceFeeder.getAveragePrice(120)
//             expect(fromEther(avg120[0]) !== "0").to.true

//         }
//     })
// })
