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
            web3.utils.toWei("100"),
            bob
        )

    })

    it('Initial values are correct', async () => {

        const currentState = await priceResolver.state()
        assert(currentState, 0)

        const initialRate = await priceResolver.getCurrentPrice()
        assert("2500", web3.utils.fromWei(initialRate))
    })

    it('Set state to normal ', async () => {

        await priceResolver.init()
        // normal state
        const currentState = await priceResolver.state()
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
        assert(web3.utils.fromWei(cofficient[0]), "0.16")
        assert(web3.utils.fromWei(cofficient[1]), "2.56")

        const adjusted = await priceResolver.getAdjustedPrice()
        assert(web3.utils.fromWei(adjusted[0]), "16")
        assert(web3.utils.fromWei(adjusted[1]), "256")

    })

    it('Check from proxies', async () => {

        const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
        const priceFeederShortAddress = await priceResolver.getPriceFeederShort()

        const priceFeederLong = await PriceFeeder.at(priceFeederLongAddress)
        const priceFeederShort = await PriceFeeder.at(priceFeederShortAddress)

        const longValue = await priceFeederLong.getValue()
        assert(web3.utils.fromWei(longValue), "16")

        const shortValue = await priceFeederShort.getValue()
        assert(web3.utils.fromWei(shortValue), "256")

    })

    it('dump prices', async () => {

        let currentUnixDay = await priceResolver.currentUnixDay()
        let todayPrice = await priceResolver.historicalPrices(currentUnixDay)
        assert(todayPrice, 0)

        await priceResolver.dump({ from: bob })

        todayPrice = await priceResolver.historicalPrices(currentUnixDay)
        assert(web3.utils.fromWei(todayPrice), "2500")

        let avgPrice = await priceResolver.getAvgPrice()
        assert(web3.utils.fromWei(avgPrice), "2500")

        let count = 0
        let dummyValue = 2500
        while (true) {
            // only 6 data points
            if (count >= 60) {
                break;
            } else {
                count = count + 10;
            }
            dummyValue = dummyValue + count
            await priceResolver.forceDump(currentUnixDay - count, web3.utils.toWei(`${dummyValue}`), { from: bob })
        }

        avgPrice = await priceResolver.getAvgPrice()
        assert(web3.utils.fromWei(avgPrice), "2580")

        let referencePrice = await priceResolver.referencePrice()
        assert(web3.utils.fromWei(referencePrice), "2500")

        await priceResolver.updateReferencePrice({ from: bob })

        referencePrice = await priceResolver.referencePrice()
        assert(web3.utils.fromWei(referencePrice), "2580")

    })

})


contract('PriceResolver - 0.5x leverage', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    before(async () => {

        priceFeed = await PriceFeeder.new("TEST/USD")

        await priceFeed.updateValue(web3.utils.toWei("1000"))

        priceResolver = await PriceResolver.new(
            0,
            priceFeed.address,
            web3.utils.toWei("1000"),
            web3.utils.toWei("100"),
            bob
        )
    })

    it('Set state to normal ', async () => {
        await priceResolver.init()

        const cofficient = await priceResolver.currentCoefficient()
        assert(web3.utils.fromWei(cofficient[0]), "1")
        assert(web3.utils.fromWei(cofficient[1]), "1")

        await priceFeed.updateValue(web3.utils.toWei("1000"))
    })

    it('Increase price up 10% from ref. price', async () => {
        await priceFeed.updateValue(web3.utils.toWei("1100"))

        const cofficient = await priceResolver.currentCoefficient()
        
        assert(web3.utils.fromWei(cofficient[0]), "1.048808848")
        assert(web3.utils.fromWei(cofficient[1]), "0.948683298")

        const adjusted = await priceResolver.getAdjustedPrice()
        assert(web3.utils.fromWei(adjusted[0]), "104.8808848")
        assert(web3.utils.fromWei(adjusted[1]), "94.8683298")
    })

    it('Dump price down 60% from ref. price', async () => {
        await priceFeed.updateValue(web3.utils.toWei("400"))

        const cofficient = await priceResolver.currentCoefficient()
        assert(web3.utils.fromWei(cofficient[0]), "0.632455532")
        assert(web3.utils.fromWei(cofficient[1]), "1.264911064")

        const adjusted = await priceResolver.getAdjustedPrice()
        assert(web3.utils.fromWei(adjusted[0]), "63.2455532")
        assert(web3.utils.fromWei(adjusted[1]), "126.4911064")

    })



})