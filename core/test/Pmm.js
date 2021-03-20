const Pmm = artifacts.require('Pmm');
const MockToken = artifacts.require('MockToken')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')

let priceFeed
let baseToken
let quoteToken
let pmm

contract('Pmm', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    beforeEach(async () => {

        baseToken = await MockToken.new("Test Synthetic", "TEST")
        quoteToken = await MockToken.new("USD Stablecoin", "USD")
        priceFeed  = await PriceFeeder.new("TEST/USD")
        tokenFactory = await TokenFactory.new()

        pmm = await Pmm.new(
            tokenFactory.address,
            baseToken.address,
            quoteToken.address,
            priceFeed.address,
            web3.utils.toWei("0.002"), // LP Fee Rate 0.2%
            web3.utils.toWei("0.001"), // Maintenance Fee Rate 0.1%
            web3.utils.toWei("0.1") // K 
        )

    });

    it('test test test', async () => {
        assert.equal( true, true);
    });

})