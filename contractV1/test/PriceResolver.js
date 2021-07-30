const PriceFeeder = artifacts.require('PriceFeeder')
const PriceResolver = artifacts.require('PriceResolver')
const ProxyFeeder = artifacts.require('ProxyFeeder')
const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')

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

contract('PriceResolver - Bitcoin', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    let isMainnet = false
    let chainlinkPriceFeeder

    before(async () => {

        try {

            chainlinkPriceFeeder = await ChainlinkPriceFeeder.new(
                "Bitcoin",
                "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
                8
            )

            if (await chainlinkPriceFeeder.getValue() !== 0) {
                isMainnet = true
            }

            priceResolver = await PriceResolver.new(
                1,
                chainlinkPriceFeeder.address,
                web3.utils.toWei("35000"),
                web3.utils.toWei("100"),
                bob
            )

        } catch (e) {
            // console.log(e)
        }

    })

    it('Initial values are correct', async () => {
        if (isMainnet) {
            const currentState = await priceResolver.state()
            assert(currentState, 0)

            const initialRate = await priceResolver.getCurrentPrice()
            assert(web3.utils.fromWei(initialRate) !== "0", true)
        }

    })

    it('Set state to normal ', async () => {

        if (isMainnet) {
            await priceResolver.init()
            // normal state
            const currentState = await priceResolver.state()
            assert(currentState, 1)

            const cofficient = await priceResolver.currentCoefficient()
            assert(web3.utils.fromWei(cofficient[0]) !== "1", true)
            assert(web3.utils.fromWei(cofficient[1]) !== "1", true)
        }

    })

    it('Emergency & primary prices  are aligned with coefficient values ', async () => {

        if (isMainnet) {
            const cofficient = await priceResolver.currentCoefficient()

            const emergencyPrice = await priceResolver.getEmergencyReferencePrice()
            assert(web3.utils.fromWei(emergencyPrice) !== "0" , true)

            const primaryPrice = await priceResolver.getPrimaryReferencePrice()

            assert(web3.utils.fromWei(primaryPrice) !== "0" , true)
            const currentPrice = await priceResolver.getCurrentPrice()
            const ratio = Number(web3.utils.fromWei(currentPrice)) / Number(web3.utils.fromWei(primaryPrice))

            assert( ratio.toFixed(2), Number(cofficient).toFixed(2))
            assert( ratio.toFixed(2), Number(web3.utils.fromWei(cofficient[0])).toFixed(2))
        }

    })


})