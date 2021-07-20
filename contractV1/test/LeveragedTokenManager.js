const LeveragedTokenManager = artifacts.require('LeveragedTokenManager')
const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')
const SyntheticToken = artifacts.require('SyntheticToken')
const MockToken = artifacts.require('MockToken')
const PriceResolver = artifacts.require('PriceResolver')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const Pmm = artifacts.require('Pmm')
const ExchangeCore = artifacts.require('ExchangeCore')
const ExchangePair = artifacts.require('ExchangePair')

let priceFeed
let leveragedTokenManager
let priceResolver
let longToken
let shortToken
let baseToken
let quoteToken
let pmmLong
let pmmShort
let exchangeCore
let exchangePairLong
let exchangePairShort

// contract('Leveraged Token Manager', accounts => {

//     const admin = accounts[0]
//     const alice = accounts[1]
//     const bob = accounts[2]

//     let isMainnet = false

//     before(async () => {

//         try {

//             const usToken = await MockToken.new(
//                 "USD Stablecoin",
//                 "USD"
//             )

//             priceFeed = await ChainlinkPriceFeeder.new(
//                 "Facebook Stock",
//                 "0xCe1051646393087e706288C1B57Fd26446657A7f",
//                 8
//             )

//             priceResolver = await PriceResolver.new(
//                 2,
//                 priceFeed.address,
//                 web3.utils.toWei("330"), // Reference Price
//                 web3.utils.toWei("100"), // Index Starting Price
//                 admin
//             )

//             await priceResolver.init()

//             const tokenFactory = await TokenFactory.new()

//             leveragedTokenManager = await LeveragedTokenManager.new(
//                 "Facebook 2x Leveraged",
//                 "fb-2x",
//                 2,
//                 tokenFactory.address,
//                 priceResolver.address,
//                 usToken.address,
//                 admin
//             )

//             longToken = await SyntheticToken.at(await leveragedTokenManager.getLongToken())
//             shortToken = await SyntheticToken.at(await leveragedTokenManager.getShortToken())

//             quoteToken = await MockToken.at(await leveragedTokenManager.getQuoteToken())

//             const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
//             const priceFeederShortAddress = await priceResolver.getPriceFeederShort()

//             pmmLong = await Pmm.new(
//                 tokenFactory.address,
//                 leveragedTokenManager.address,
//                 longToken.address,
//                 quoteToken.address,
//                 priceFeederLongAddress,
//                 web3.utils.toWei("0.99") // K 
//             )

//             pmmShort = await Pmm.new(
//                 tokenFactory.address,
//                 leveragedTokenManager.address,
//                 shortToken.address,
//                 quoteToken.address,
//                 priceFeederShortAddress,
//                 web3.utils.toWei("0.99") // K 
//             )

//             await quoteToken.transfer(alice, web3.utils.toWei("10000"))

//             await quoteToken.approve(
//                 leveragedTokenManager.address,
//                 web3.utils.toWei("1000000"),
//                 {
//                     from: alice
//                 }
//             )

//             await leveragedTokenManager.setupPmm(
//                 pmmLong.address,
//                 pmmShort.address
//             )

//             await quoteToken.transfer(bob, web3.utils.toWei("1000"))

//             isMainnet = true
//         } catch (e) {
//             console.log(e)
//         }

//     })

//     it('all leveraged token name/symbol are valid', async () => {
//         if (isMainnet) {
//             const longTokenName = await longToken.name()
//             assert(longTokenName.indexOf("Long") !== -1, true)
//             const longTokenSymbol = await longToken.symbol()
//             assert(longTokenSymbol.indexOf("LONG") !== -1, true)

//             const shortTokenName = await shortToken.name()
//             assert(shortTokenName.indexOf("Short") !== -1, true)
//             const shortTokenSymbol = await shortToken.symbol()
//             assert(shortTokenSymbol.indexOf("SHORT") !== -1, true)
//         }
//     })

//     it('mint long/short tokens', async () => {
//         if (isMainnet) {

//             const currentBalance = await quoteToken.balanceOf(alice)
//             const currentPrice = await leveragedTokenManager.getCurrentPrice()
//             assert(currentPrice !== 0, true)

//             const output = await leveragedTokenManager.estimateTokenOut(currentBalance)
//             assert(web3.utils.fromWei(output[0]) !== web3.utils.fromWei(output[1]), true)

//             await leveragedTokenManager.mint(currentBalance, { from: alice })
//             const totalLongToken = await longToken.balanceOf(alice)
//             assert(Number(web3.utils.fromWei(totalLongToken)) > 0, true)

//             const totalShortToken = await shortToken.balanceOf(alice)
//             assert(Number(web3.utils.fromWei(totalShortToken)) > 0, true)

//         }
//     })

//     it('deposit long/short tokens', async () => {
//         if (isMainnet) {
//             // deposit to PMM
//             const usdBalance = await quoteToken.balanceOf(alice)
//             const halfAmount = Number(web3.utils.fromWei(usdBalance)) / 2
//             const shortTokenBalance = await shortToken.balanceOf(alice)
//             const longTokenBalance = await longToken.balanceOf(alice)

//             await longToken.approve(leveragedTokenManager.address, web3.utils.toWei("10000"), { from: alice })
//             await shortToken.approve(leveragedTokenManager.address, web3.utils.toWei("10000"), { from: alice })

//             // PMM-long
//             await leveragedTokenManager.addLiquidity(1, longTokenBalance, web3.utils.toWei(`${halfAmount}`), { from: alice })

//             // PMM-short
//             await leveragedTokenManager.addLiquidity(2, shortTokenBalance, await quoteToken.balanceOf(alice), { from: alice })
//         }
//     })

//     it('buy and sell short token', async () => {
//         if (isMainnet) {

//             await quoteToken.transfer(alice, web3.utils.toWei("10000"))

//             const buyPrice = await leveragedTokenManager.queryBuyLeveragedToken(2, web3.utils.toWei("1"))
//             await leveragedTokenManager.buyLeveragedToken(2, web3.utils.toWei("1"), buyPrice, { from: alice })

//             let currentBalance = await shortToken.balanceOf(alice)
//             assert("1", web3.utils.fromWei(currentBalance))

//             const sellPrice = await leveragedTokenManager.querySellLeveragedToken(2, web3.utils.toWei("1"))

//             await leveragedTokenManager.sellLeveragedToken(2, web3.utils.toWei("1"), sellPrice, { from: alice })

//         }
//     })

//     it('redeem quote tokens back', async () => {
//         if (isMainnet) {
//             let bobBalance = await quoteToken.balanceOf(bob)

//             await quoteToken.approve(leveragedTokenManager.address, web3.utils.toWei("10000"), { from: bob })

//             await leveragedTokenManager.mint(bobBalance, { from: bob })

//             const totalLongToken = await longToken.balanceOf(bob)
//             assert(Number(web3.utils.fromWei(totalLongToken)) > 0, true)

//             const totalShortToken = await shortToken.balanceOf(bob)
//             assert(Number(web3.utils.fromWei(totalShortToken)) > 0, true)

//             await longToken.approve(leveragedTokenManager.address, web3.utils.toWei("10000"), { from: bob })
//             await shortToken.approve(leveragedTokenManager.address, web3.utils.toWei("10000"), { from: bob })

//             const redeemAmount = Number(web3.utils.fromWei(bobBalance)) * 0.5

//             bobBalance = await quoteToken.balanceOf(bob)
//             assert(bobBalance.toString(), "0")

//             await leveragedTokenManager.redeem( web3.utils.toWei(`${redeemAmount}`) , { from: bob })

//             bobBalance = await quoteToken.balanceOf(bob)
//             assert(`${redeemAmount}`, web3.utils.fromWei(bobBalance))

//         }
//     })

// })


contract('Leveraged Token Manager', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]
    const dev = accounts[3]

    let isMainnet = false

    before(async () => {

        try {

            const usToken = await MockToken.new(
                "USD Stablecoin",
                "USD"
            )

            priceFeed = await ChainlinkPriceFeeder.new(
                "Facebook Stock",
                "0xCe1051646393087e706288C1B57Fd26446657A7f",
                8
            )

            priceResolver = await PriceResolver.new(
                2,
                priceFeed.address,
                web3.utils.toWei("330"), // Reference Price
                web3.utils.toWei("100"), // Index Starting Price
                admin
            )

            await priceResolver.init()

            const tokenFactory = await TokenFactory.new()

            leveragedTokenManager = await LeveragedTokenManager.new(
                "Facebook 2x Leveraged",
                "fb-2x",
                2,
                tokenFactory.address,
                priceResolver.address,
                usToken.address,
                admin
            )

            longToken = await SyntheticToken.at(await leveragedTokenManager.getLongToken())
            shortToken = await SyntheticToken.at(await leveragedTokenManager.getShortToken())

            quoteToken = await MockToken.at(await leveragedTokenManager.getQuoteToken())

            const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
            const priceFeederShortAddress = await priceResolver.getPriceFeederShort()

            exchangeCore = await ExchangeCore.new(
                quoteToken.address,
                dev,
                {
                    from: admin
                }
            )

            exchangePairLong = await ExchangePair.new(
                exchangeCore.address,
                longToken.address,
                priceFeederLongAddress,
                {
                    from: admin
                }
            )

            exchangePairShort = await ExchangePair.new(
                exchangeCore.address,
                shortToken.address,
                priceFeederShortAddress,
                {
                    from: admin
                }
            )

            await exchangeCore.enable()

            await exchangeCore.addPair("Facebook Stock")
            await exchangeCore.setLeveragedTokenAddress(0, 2, exchangePairLong.address, exchangePairShort.address)

            await quoteToken.transfer(alice, web3.utils.toWei("10000"))

            await quoteToken.approve(
                leveragedTokenManager.address,
                web3.utils.toWei("1000000"),
                {
                    from: alice
                }
            )

            await leveragedTokenManager.setupPmm(
                exchangePairLong.address,
                exchangePairShort.address
            )

            isMainnet = true

        } catch (e) {
            // console.log(e)
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

    it('mint long/short tokens', async () => {
        if (isMainnet) {

            const currentBalance = await quoteToken.balanceOf(alice)
            const currentPrice = await leveragedTokenManager.getCurrentPrice()
            assert(currentPrice !== 0, true)

            const output = await leveragedTokenManager.estimateTokenOut(currentBalance)
            assert(web3.utils.fromWei(output[0]) !== web3.utils.fromWei(output[1]), true)

            await leveragedTokenManager.mint(currentBalance, { from: alice })
            const totalLongToken = await longToken.balanceOf(alice)
            assert(Number(web3.utils.fromWei(totalLongToken)) > 0, true)

            const totalShortToken = await shortToken.balanceOf(alice)
            assert(Number(web3.utils.fromWei(totalShortToken)) > 0, true)

        }
    })

    it('Deposit long/short tokens by Alice', async () => {
        if (isMainnet) {
            // deposit to PMM
            await quoteToken.transfer(alice, web3.utils.toWei("1000"))
            const usdBalance = await quoteToken.balanceOf(alice)

            const shortTokenBalance = await shortToken.balanceOf(alice)
            const longTokenBalance = await longToken.balanceOf(alice)

            await longToken.approve(exchangePairLong.address, web3.utils.toWei("10000"), { from: alice })
            await quoteToken.approve(exchangePairLong.address, web3.utils.toWei("10000"), { from: alice })
            await shortToken.approve(exchangePairShort.address, web3.utils.toWei("10000"), { from: alice })

            // Pair-long
            // await leveragedTokenManager.addLiquidity(1, longTokenBalance, web3.utils.toWei(`${halfAmount}`), { from: alice })
            await exchangePairLong.depositBase( longTokenBalance , { from: alice })
            await exchangePairLong.depositQuote( usdBalance , { from: alice })

            // Pair-short
            // await leveragedTokenManager.addLiquidity(2, shortTokenBalance, await quoteToken.balanceOf(alice), { from: alice })
            await exchangePairShort.depositBase( shortTokenBalance , { from: alice })

        }
    })

    it('buy and sell long tokens by Bob', async () => {
        
        if (isMainnet) {
            
            await quoteToken.transfer(bob, web3.utils.toWei("10000"))
        
            await quoteToken.approve( exchangePairLong.address, web3.utils.toWei("10000") , { from : bob })

            const buyPrice = await exchangePairLong.queryBuyBaseToken( web3.utils.toWei("2"))
            await exchangePairLong.buyBaseToken( web3.utils.toWei("2"), buyPrice, { from: bob })

            let totalLong = await longToken.balanceOf(bob)
            assert("1.994", web3.utils.fromWei(totalLong))

            const before = await quoteToken.balanceOf(bob)

            await longToken.approve( exchangePairLong.address,   web3.utils.toWei("10000") , { from : bob})

            const sellPrice = await exchangePairLong.querySellBaseToken( web3.utils.toWei("1"))
            await exchangePairLong.sellBaseToken( web3.utils.toWei("1"), sellPrice, { from: bob })

            const after = await quoteToken.balanceOf(bob)
            assert( Number(web3.utils.fromWei(after)) > Number(web3.utils.fromWei(before)) , true )
            totalLong = await longToken.balanceOf(bob)
            assert("0.994", web3.utils.fromWei(totalLong))
        }
    
    })

    it('buy and sell short tokens by Bob', async () => {
        
        if (isMainnet) {
            
            await quoteToken.approve( exchangePairShort.address, web3.utils.toWei("10000") , { from : bob })

            const buyPrice = await exchangePairShort.queryBuyBaseToken( web3.utils.toWei("2"))
            await exchangePairShort.buyBaseToken( web3.utils.toWei("2"), buyPrice, { from: bob })

            let totalShort = await shortToken.balanceOf(bob)
            assert("1.994", web3.utils.fromWei(totalShort))

            const before = await quoteToken.balanceOf(bob)

            await shortToken.approve( exchangePairShort.address,   web3.utils.toWei("10000") , { from : bob})

            const sellPrice = await exchangePairShort.querySellBaseToken( web3.utils.toWei("1"))
            await exchangePairShort.sellBaseToken( web3.utils.toWei("1"), sellPrice, { from: bob })

            const after = await quoteToken.balanceOf(bob)
            assert( Number(web3.utils.fromWei(after)) > Number(web3.utils.fromWei(before)) , true )
            totalShort = await shortToken.balanceOf(bob)
            assert("0.994", web3.utils.fromWei(totalShort))
        }
    
    })

})