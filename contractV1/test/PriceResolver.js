const PriceFeeder = artifacts.require('PriceFeeder')
const PriceResolver = artifacts.require('PriceResolver') 
const ProxyFeeder = artifacts.require('ProxyFeeder') 

let priceFeed
let priceResolver


contract('PriceResolver', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    before(async () => {
        
        priceFeed = await PriceFeeder.new("ETH/USD")

        await priceFeed.updateValue(web3.utils.toWei("2500"))
    
        priceResolver = await PriceResolver.new(
            1,
            priceFeed.address,
            web3.utils.toWei("2500"),
            web3.utils.toWei("100")
        )

    })

    it('Initial values are correct', async () => {
        
        const currentState =  await priceResolver.state()
        assert(currentState, 0)

        const initialRate = await priceResolver.getCurrentPrice()
        assert( "2500" ,web3.utils.fromWei(initialRate) )
    })

    it('Set state to normal ', async () => {
        
        await priceResolver.init()
        // normal state
        const currentState =  await priceResolver.state()
        assert(currentState, 1)

        const cofficient = await priceResolver.currentCoefficient()
        assert(web3.utils.fromWei(cofficient[0]), "1")
        assert(web3.utils.fromWei(cofficient[1]), "1")

        await priceFeed.updateValue(web3.utils.toWei("2500"))
    })

    it('Increase price up 10% from ref. price', async () => {
        await priceFeed.updateValue(web3.utils.toWei("2750"))

        const cofficient = await priceResolver.currentCoefficient()
        assert(web3.utils.fromWei(cofficient[0]), "1.21")
        assert(web3.utils.fromWei(cofficient[1]), "0.81")

        const adjusted = await priceResolver.getAdjustedPrice()
        assert(web3.utils.fromWei(adjusted[0]), "121")
        assert(web3.utils.fromWei(adjusted[1]), "81")

    })

    it('Dump price down 60% from ref. price', async () => {
        await priceFeed.updateValue(web3.utils.toWei("1000"))

        const cofficient = await priceResolver.currentCoefficient()
        assert(web3.utils.fromWei(cofficient[0]) , "0.16")
        assert(web3.utils.fromWei(cofficient[1]) , "2.56")

        const adjusted = await priceResolver.getAdjustedPrice()
        assert(web3.utils.fromWei(adjusted[0]), "16")
        assert(web3.utils.fromWei(adjusted[1]), "256")

    })

    it('Check from proxies', async () => {

        const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
        const priceFeederShortAddress =  await priceResolver.getPriceFeederShort()

        const priceFeederLong = await PriceFeeder.at(priceFeederLongAddress)
        const priceFeederShort = await PriceFeeder.at(priceFeederShortAddress)

        const longValue = await priceFeederLong.getValue()
        assert(web3.utils.fromWei(longValue) , "16")

        const shortValue = await priceFeederShort.getValue()
        assert(web3.utils.fromWei(shortValue) , "256")

    })

})