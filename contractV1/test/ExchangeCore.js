const PriceFeeder = artifacts.require('PriceFeeder')
const ExchangeCore = artifacts.require('ExchangeCore')
const ExchangePair = artifacts.require('ExchangePair')
const MockToken = artifacts.require('MockToken')

let priceFeed
let baseToken
let baseToken2
let quoteToken
let exchangeCore 

contract('ExchangePair', accounts => {
    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]
    const dev = accounts[3]

    before(async () => {

        baseToken = await MockToken.new("Test Synthetic", "TEST")
        baseToken2 = await MockToken.new("Test Synthetic #2", "TEST#2")
        quoteToken = await MockToken.new("USD Stablecoin", "USD")
        priceFeed = await PriceFeeder.new("TEST/USD")

        await priceFeed.updateValue(web3.utils.toWei("500"))

        exchangeCore = await ExchangeCore.new(
            quoteToken.address,
            dev,
            {
                from: admin
            }
        )



        await exchangeCore.enable()

    })

    it('Update params', async () => {
        
        let fee = await exchangeCore.fee()
        assert("0.003", web3.utils.fromWei(fee)) 

        await exchangeCore.setFee(0)

        fee = await exchangeCore.fee()
        assert("0", web3.utils.fromWei(fee)) 

    })

    it('Add and Remove pairs', async () => {

        const exchangePair = await ExchangePair.new(
            exchangeCore.address,
            baseToken.address,
            priceFeed.address,
            {
                from: admin
            }
        )

        const exchangePair2 = await ExchangePair.new(
            exchangeCore.address,
            baseToken2.address,
            priceFeed.address,
            {
                from: admin
            }
        )

        await exchangeCore.addPair("Test")
        await exchangeCore.setLeveragedTokenAddress(0, 1, exchangePair.address, exchangePair2.address)

        await exchangeCore.addPair("Test#2")
        await exchangeCore.setLeveragedTokenAddress(1, 1, exchangePair2.address, exchangePair.address)
    
        const totalPairs = await exchangeCore.totalPairs()
        assert("2", totalPairs.toString())

        const firstPairName = await exchangeCore.getPairName(0)
        assert("Test", firstPairName)

        const secondPairName = await exchangeCore.getPairName(1)
        assert("Test#2", secondPairName)
    
        const firstPair = await exchangeCore.getPairTokens(0, 2)
        assert( firstPair[0] ,  exchangePair.address )
        assert( firstPair[1] ,  exchangePair2.address )

        const secondPair = await exchangeCore.getPairTokens(1, 2)
        assert( secondPair[0] ,  exchangePair2.address )
        assert( secondPair[1] ,  exchangePair.address )

    })

})