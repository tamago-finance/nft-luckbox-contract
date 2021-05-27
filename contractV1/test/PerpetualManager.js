const PriceFeeder = artifacts.require('PriceFeeder')
const PriceResolver = artifacts.require('PriceResolver')
const Reserves = artifacts.require('Reserves')
const PerpetualManager = artifacts.require('PerpetualManager')
const TokenFactory = artifacts.require('TokenFactory')
const MockToken = artifacts.require('MockToken')
const SyntheticToken = artifacts.require('SyntheticToken')
const Pmm = artifacts.require('Pmm')

const { getContracts, advanceTimeAndBlock, getLoanId, WAITING_PERIOD, setupReserves } = require("./helpers/Utils")

let reserves
let priceFeed
let perpetualManager
let priceResolver
let longToken
let shortToken
let baseToken
let quoteToken
let pmmLong
let pmmShort

contract('Perpetual Manager', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    let isMainnet = false

    before(async () => {

        try {
            const { ResolverAddress } = getContracts()

            reserves = await setupReserves(Reserves)
            await reserves.addAddress(alice)
            await reserves.addAddress(bob)

            priceFeed = await PriceFeeder.new("ETH/USD")
            await priceFeed.updateValue(web3.utils.toWei("2500"))

            priceResolver = await PriceResolver.new(
                1,
                priceFeed.address,
                web3.utils.toWei("2500"),
                web3.utils.toWei("100")
            )

            await priceResolver.init()

            const tokenFactory = await TokenFactory.new()

            perpetualManager = await PerpetualManager.new(
                "SynthsETH 1x Leveraged",
                "sETH-1x",
                1,
                tokenFactory.address,
                reserves.address,
                priceResolver.address,
                ResolverAddress,
                "0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb", // sETH
                "0x73455448" // sETH
            )

            await reserves.addAddress(perpetualManager.address);

            longToken = await SyntheticToken.at(await perpetualManager.getLongToken())
            shortToken = await SyntheticToken.at(await perpetualManager.getShortToken())

            quoteToken = await MockToken.at(await perpetualManager.getQuoteToken())
            baseToken = await MockToken.at(await perpetualManager.getBaseToken())

            const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
            const priceFeederShortAddress = await priceResolver.getPriceFeederShort()

            pmmLong = await Pmm.new(
                tokenFactory.address,
                perpetualManager.address,
                longToken.address,
                quoteToken.address,
                priceFeederLongAddress,
                web3.utils.toWei("0.99") // K 
            )

            pmmShort = await Pmm.new(
                tokenFactory.address,
                perpetualManager.address,
                shortToken.address,
                quoteToken.address,
                priceFeederShortAddress,
                web3.utils.toWei("0.99") // K 
            )

            await baseToken.approve(perpetualManager.address, web3.utils.toWei("1000000") , { from : alice })

            await perpetualManager.setupPmm(
                pmmLong.address,
                pmmShort.address
            )

            isMainnet = true
        } catch (e) {
            console.log(e)
        }

    })

    it('all leveraged token name/symbol are valid', async () => {
        if (isMainnet) {
            const longTokenName = await longToken.name()
            assert(longTokenName.indexOf("Long") !== -1, true)
            const longTokenSymbol = await longToken.symbol()
            assert(longTokenSymbol.indexOf("LONG") !== -1, true)

            const shortTokenName = await shortToken.name()
            assert(shortTokenName.indexOf("Short") !== -1, true)
            const shortTokenSymbol = await shortToken.symbol()
            assert(shortTokenSymbol.indexOf("SHORT") !== -1, true)
        }
    })

    it('funding sETH and sUSD to Alice', async () => {
        if (isMainnet) {
            const sEthAvailable = await reserves.reserves(baseToken.address)
            const sUsdAvailable = await reserves.reserves(quoteToken.address)

            // Funding sETH
            const quarter = Number(web3.utils.fromWei(sEthAvailable)) / 4

            await reserves.withdraw(baseToken.address , web3.utils.toWei(`${quarter}`), { from: alice })

            const currentBaseBalance = await baseToken.balanceOf(alice)
            assert((currentBaseBalance.toString()) !== "0")

            // Funding sUSD
            const half = Number(web3.utils.fromWei(sUsdAvailable)) / 2

            await reserves.withdraw(quoteToken.address , web3.utils.toWei(`${half}`), { from: alice })

            const currentQuoteBalance = await quoteToken.balanceOf(alice)
            assert((currentQuoteBalance.toString()) !== "0")

            // Funding Bob
            await reserves.withdraw(quoteToken.address , await reserves.reserves(quoteToken.address), { from: bob })

            const bobBalance = await quoteToken.balanceOf(bob)
            assert((bobBalance.toString()) !== "0")
        }
    })

    it('mint long/short tokens', async () => {
        if (isMainnet) {
            
            // const currentBalance = await baseToken.balanceOf(alice)
            // const output = await perpetualManager.estimateTokenOut(currentBalance )
            // assert( web3.utils.fromWei(output[0]), web3.utils.fromWei(output[1]) ) 

            // await perpetualManager.mint(currentBalance , { from : alice })
            // const totalLongToken = await longToken.balanceOf(alice)
            // console.log("totalLongToken --> ", web3.utils.fromWei(totalLongToken))

            // const totalShortToken = await shortToken.balanceOf(alice)
            // console.log("totalShortToken --> ", web3.utils.fromWei(totalShortToken))
        }
    })

    it('mint long/short tokens when the current price goes up', async () => {
        if (isMainnet) {
            // mint short/long tokens
            await priceFeed.updateValue(web3.utils.toWei("2750"))

            const currentBalance = await baseToken.balanceOf(alice)
            const output = await perpetualManager.estimateTokenOut( currentBalance)
            assert( web3.utils.fromWei(output[0]) !== web3.utils.fromWei(output[1]), true ) 

            await perpetualManager.mint(currentBalance , { from : alice })
            const totalLongToken = await longToken.balanceOf(alice)
            assert( Number(web3.utils.fromWei(totalLongToken)) > 0, true)

            const totalShortToken = await shortToken.balanceOf(alice)
            assert( Number(web3.utils.fromWei(totalShortToken)) > 0, true)
        }
    })

    it('deposit long/short tokens', async () => {
        if (isMainnet) {
            // deposit to PMM
            const sUsdBalance = await quoteToken.balanceOf(alice)
            const halfQuoteAmount = Number(web3.utils.fromWei(sUsdBalance)) / 2
            const shortTokenBalance = await shortToken.balanceOf(alice)
            const longTokenBalance = await longToken.balanceOf(alice)

            await longToken.approve(perpetualManager.address, web3.utils.toWei("10000") , { from : alice })
            await shortToken.approve(perpetualManager.address, web3.utils.toWei("10000"), { from : alice })
            await quoteToken.approve(perpetualManager.address, web3.utils.toWei("10000"), { from : alice }) 

            // PMM-long
            await perpetualManager.addLiquidity(1, longTokenBalance , web3.utils.toWei(`${halfQuoteAmount}`) ,{ from : alice })

            // PMM-short
            await perpetualManager.addLiquidity(2, shortTokenBalance , await quoteToken.balanceOf(alice) ,{ from : alice })
        }
    })

    it('buy and sell long token', async () => {
        if (isMainnet) {
            
            await quoteToken.approve( perpetualManager.address, web3.utils.toWei("10000") , { from : bob} )

            const buyPrice = await perpetualManager.queryBuyLeveragedToken( 1,  web3.utils.toWei("0.1") )
            assert( Number(web3.utils.fromWei(buyPrice)).toFixed(0) , 12 )
            await perpetualManager.buyLeveragedToken( 1, web3.utils.toWei("0.1") , buyPrice , { from: bob })

            let currentBalance = await longToken.balanceOf(bob)
            assert("0.1" , web3.utils.fromWei(currentBalance))
            // +10%
            await priceFeed.updateValue(web3.utils.toWei("3025"))

            let sellPrice = await perpetualManager.querySellLeveragedToken( 1, web3.utils.toWei("0.1") ) 
            assert( Number(web3.utils.fromWei(sellPrice)).toFixed(0) , 14 )

            // -30%
            await priceFeed.updateValue(web3.utils.toWei("2117"))
            sellPrice = await perpetualManager.querySellLeveragedToken( 1, web3.utils.toWei("0.1") ) 
            assert( Number(web3.utils.fromWei(sellPrice)).toFixed(0) , 7 )

            await longToken.approve( perpetualManager.address, web3.utils.toWei("10000") , { from : bob} )
            await perpetualManager.sellLeveragedToken( 1, web3.utils.toWei("0.1") , sellPrice , { from: bob })
        
        }
    })

    it('buy and sell short token', async () => {
        if (isMainnet) {
            
            await priceFeed.updateValue(web3.utils.toWei("2500"))

            const buyPrice = await perpetualManager.queryBuyLeveragedToken( 2,  web3.utils.toWei("0.1") )
            assert( Number(web3.utils.fromWei(buyPrice)).toFixed(0) , 10 )
            await perpetualManager.buyLeveragedToken( 2, web3.utils.toWei("0.1") , buyPrice , { from: bob })

            let currentBalance = await shortToken.balanceOf(bob)
            assert("0.1" , web3.utils.fromWei(currentBalance))
            // -10%
            await priceFeed.updateValue(web3.utils.toWei("2250"))

            const sellPrice = await perpetualManager.querySellLeveragedToken( 2, web3.utils.toWei("0.1") ) 
            assert( Number(web3.utils.fromWei(sellPrice)).toFixed(0) , 12 )

            await shortToken.approve( perpetualManager.address, web3.utils.toWei("10000") , { from : bob} )
            await perpetualManager.sellLeveragedToken( 2, web3.utils.toWei("0.1") , sellPrice , { from: bob })
            
        }
    })

})