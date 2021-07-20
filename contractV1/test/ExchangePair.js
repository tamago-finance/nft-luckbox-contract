const PriceFeeder = artifacts.require('PriceFeeder')
const ExchangeCore = artifacts.require('ExchangeCore')
const ExchangePair = artifacts.require('ExchangePair')
const MockToken = artifacts.require('MockToken')

let priceFeed
let baseToken
let quoteToken
let exchangeCore
let exchangePair

contract('ExchangePair', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]
    const dev = accounts[3]

    before(async () => {

        baseToken = await MockToken.new("Test Synthetic", "TEST")
        quoteToken = await MockToken.new("USD Stablecoin", "USD")
        priceFeed = await PriceFeeder.new("TEST/USD")

        await baseToken.transfer(alice, web3.utils.toWei("50000"))
        // await baseToken.transfer(bob, web3.utils.toWei("50000"))
        await quoteToken.transfer(alice, web3.utils.toWei("50000"))
        await quoteToken.transfer(bob, web3.utils.toWei("50000"))

        await priceFeed.updateValue(web3.utils.toWei("100"))

        exchangeCore = await ExchangeCore.new(
            quoteToken.address,
            dev,
            {
                from: admin
            }
        )

        exchangePair = await ExchangePair.new(
            exchangeCore.address,
            baseToken.address,
            priceFeed.address,
            {
                from: admin
            }
        )

        await exchangeCore.enable()

        await exchangeCore.addPair("Test")
        await exchangeCore.setLeveragedTokenAddress(0, 2, exchangePair.address, exchangePair.address)

        await baseToken.approve(exchangePair.address, web3.utils.toWei("1000000"), { from: alice })
        await baseToken.approve(exchangePair.address, web3.utils.toWei("1000000"), { from: bob })
        await quoteToken.approve(exchangePair.address, web3.utils.toWei("1000000"), { from: alice })
        await quoteToken.approve(exchangePair.address, web3.utils.toWei("1000000"), { from: bob })
    })

    it('Deposit Base and Quote Tokens', async () => {

        let quoteBalance = await exchangePair.getQuoteBalance()
        let baseBalance = await exchangePair.getBaseBalance()

        assert("0", quoteBalance.toString())
        assert("0", baseBalance.toString())

        await exchangePair.depositBase(web3.utils.toWei("10000"), { from: alice })
        await exchangePair.depositQuote(web3.utils.toWei("10000"), { from: alice })

        quoteBalance = await exchangePair.getQuoteBalance()
        baseBalance = await exchangePair.getBaseBalance()

        assert("10000", web3.utils.fromWei(quoteBalance))
        assert("10000", web3.utils.fromWei(baseBalance))

        const actualQuoteBalance = await quoteToken.balanceOf(exchangeCore.address)
        assert("10000", web3.utils.fromWei(actualQuoteBalance))
        const actualBaseBalance = await baseToken.balanceOf(exchangePair.address)
        assert("10000", web3.utils.fromWei(actualBaseBalance))

    })

    it('Withdraw Base and Quote Tokens', async () => {

        let data = await exchangePair.getProviderData(alice)

        assert("10000", web3.utils.fromWei(data[0]))
        assert("10000", web3.utils.fromWei(data[1]))

        await exchangePair.withdrawBase(web3.utils.toWei("2000"), { from: alice })
        await exchangePair.withdrawQuote(web3.utils.toWei("3000"), { from: alice })

        data = await exchangePair.getProviderData(alice)
        assert("8000", web3.utils.fromWei(data[0]))
        assert("7000", web3.utils.fromWei(data[1]))

        const actualQuoteBalance = await quoteToken.balanceOf(exchangeCore.address)
        assert("7000", web3.utils.fromWei(actualQuoteBalance))
        const actualBaseBalance = await baseToken.balanceOf(exchangePair.address)
        assert("8000", web3.utils.fromWei(actualBaseBalance))
    })

    it('Buy and Sell base tokens', async () => {

        const quoteTokenIn = await exchangePair.queryBuyBaseToken(web3.utils.toWei("10"));
        assert("1000", web3.utils.fromWei(quoteTokenIn))

        let quoteBalance = await quoteToken.balanceOf(bob)
        assert("50000", web3.utils.fromWei(quoteBalance))

        await exchangePair.buyBaseToken(web3.utils.toWei("10"), quoteTokenIn, { from: bob })

        let baseBalance = await baseToken.balanceOf(bob)
        assert("9.97", (web3.utils.fromWei(baseBalance)))
        quoteBalance = await quoteToken.balanceOf(bob)
        assert("49000", web3.utils.fromWei(quoteBalance))

        await priceFeed.updateValue(web3.utils.toWei("105"))

        const quoteTokenOut = await exchangePair.querySellBaseToken(baseBalance)
        assert("1046.85", web3.utils.fromWei(quoteTokenOut))

        await exchangePair.sellBaseToken(web3.utils.toWei("9.97"), 0, { from: bob })

        baseBalance = await baseToken.balanceOf(bob)
        assert("0", web3.utils.fromWei(baseBalance))
        quoteBalance = await quoteToken.balanceOf(bob)
        assert("50043.70945", web3.utils.fromWei(quoteBalance))
    })

    it('Dev can collects fees', async () => {
        const baseBalance = await baseToken.balanceOf(dev)
        assert(web3.utils.fromWei(baseBalance).toString() !== "0")

        const quoteBalance = await quoteToken.balanceOf(dev)
        assert( web3.utils.fromWei(quoteBalance).toString() !== "0" )

    })

})
