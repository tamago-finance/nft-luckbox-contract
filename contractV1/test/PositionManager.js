const PMM = artifacts.require('PMM')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const MockToken = artifacts.require('MockToken')
const PositionManager = artifacts.require('PositionManager')
const SyntheticToken = artifacts.require('SyntheticToken')
const Reserves = artifacts.require('Reserves')

const { getContracts, advanceTimeAndBlock, getLoanId, WAITING_PERIOD, setupReserves } = require("./helpers/Utils")


let priceFeed
let pmm
let baseToken
let positionManager
let collateralToken
let reserves
let longToken
let shortToken

contract('Position Manager', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    let isMainnet = false

    before(async () => {
        try {
            const { ResolverAddress } = getContracts()

            reserves = await setupReserves(Reserves)
            await reserves.addAddress(alice)

            priceFeed = await PriceFeeder.new("ETH/USD")
            await priceFeed.updateValue(web3.utils.toWei("3000"))

            const tokenFactory = await TokenFactory.new()

            positionManager = await PositionManager.new(
                "SynthsETH 1x Leveraged",
                "sETH-1x",
                1,
                tokenFactory.address,
                reserves.address,
                priceFeed.address,
                ResolverAddress,
                "0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb", // sETH
                "0x73455448" // sETH
            )

            await reserves.addAddress(positionManager.address);

            longToken = await SyntheticToken.at(await positionManager.getLongToken())
            shortToken = await SyntheticToken.at(await positionManager.getShortToken())

            collateralToken = await MockToken.at(await positionManager.getCollateralToken())
            baseToken = await MockToken.at(await positionManager.getBaseToken())

            pmm = await PMM.new(
                tokenFactory.address,
                positionManager.address,
                baseToken.address,
                collateralToken.address,
                priceFeed.address,
                web3.utils.toWei("0.99") // K 
            )

            await collateralToken.approve(positionManager.address, web3.utils.toWei("1000000"))
            await collateralToken.approve(positionManager.address, web3.utils.toWei("1000000"), { from: alice })
            await collateralToken.approve(positionManager.address, web3.utils.toWei("1000000"), { from: bob })

            await positionManager.setupPmm(pmm.address)

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

    it('depositing base/quote tokens into PMM contract by Admin', async () => {

        if (isMainnet) {

            const sEthAvailable = await reserves.reserves(baseToken.address)
            const sUsdAvailable = await reserves.reserves(collateralToken.address)

            const depositEthAmount = Number(web3.utils.fromWei(sEthAvailable)) / 2
            const depositUsdAmount = Number(web3.utils.fromWei(sUsdAvailable)) / 2

            await positionManager.depositBaseToken(web3.utils.toWei(`${depositEthAmount}`))
            await positionManager.depositQuoteToken(web3.utils.toWei(`${depositUsdAmount}`))

        }

    })

    it('funding sUSD to Alice', async () => {

        if (isMainnet) {

            const sUsdAvailable = await reserves.reserves(collateralToken.address)
            await reserves.withdraw(collateralToken.address, sUsdAvailable, { from: alice })

            const currentBalance = await collateralToken.balanceOf(alice)
            assert((currentBalance.toString()) !== "0")

            const half = Number(web3.utils.fromWei(currentBalance)) / 2
            await collateralToken.transfer(bob, web3.utils.toWei(`${half}`), { from: alice })

        }

    })

    it('long token - index price goes up', async () => {

        if (isMainnet) {
            const indexPrice = await positionManager.getIndexPrice()
            const midPrice = await positionManager.getMidPrice()

            assert(indexPrice, midPrice)

            const price = await positionManager.getBuyPrice(web3.utils.toWei("0.1"))

            assert(Number(web3.utils.fromWei(price)).toFixed(0), 334)

            const currentBalance = await collateralToken.balanceOf(alice)
            assert(Number(web3.utils.fromWei(currentBalance)) > Number(web3.utils.fromWei(price)))

            const collateral = await positionManager.calculateCollateralLong(web3.utils.toWei("0.1"))

            await positionManager.buyLongToken(web3.utils.toWei("0.1"), collateral, { from: alice })

            const remainingBalance = await collateralToken.balanceOf(alice)

            // Rise from 3000 -> 3500
            await priceFeed.updateValue(web3.utils.toWei("3500"))

            const updatedIndexPrice = await positionManager.getIndexPrice()
            assert(Number(web3.utils.fromWei(updatedIndexPrice)), 3500)
            const updatedMidPrice = await positionManager.getMidPrice()
            assert(Number(web3.utils.fromWei(updatedMidPrice)).toFixed(0), 4240)
            const sellPrice = await positionManager.getSellPrice(web3.utils.toWei("0.1"))
            assert(Number(web3.utils.fromWei(sellPrice)), 379)

            await longToken.approve(positionManager.address, web3.utils.toWei("10000"), { from: alice })
            await positionManager.sellLongToken(web3.utils.toWei("0.1"), { from: alice })

            const latestBalance = await collateralToken.balanceOf(alice)

            // 334 -> 379
            assert((Number(web3.utils.fromWei(latestBalance) - Number(web3.utils.fromWei(remainingBalance)))).toFixed(0), 379)
        }

    })

    it('long token - index price goes down', async () => {

        const buyPrice = await positionManager.getBuyPrice(web3.utils.toWei("0.1"))
        assert(Number(web3.utils.fromWei(buyPrice)).toFixed(0), 379)

        const collateral = await positionManager.calculateCollateralLong(web3.utils.toWei("0.1"))

        await positionManager.buyLongToken(web3.utils.toWei("0.1"), collateral, { from: alice })

        const beforeBalance = await collateralToken.balanceOf(alice)

        // Dump from 3500 -> 2500
        await priceFeed.updateValue(web3.utils.toWei("2500"))

        const updatedIndexPrice = await positionManager.getIndexPrice()
        assert(Number(web3.utils.fromWei(updatedIndexPrice)), 2500)
        const updatedMidPrice = await positionManager.getMidPrice()
        assert(Number(web3.utils.fromWei(updatedMidPrice)).toFixed(0), 3230)
        const sellPrice = await positionManager.getSellPrice(web3.utils.toWei("0.1"))
        assert(Number(web3.utils.fromWei(sellPrice)).toFixed(0), 289 )

        await longToken.approve(positionManager.address, web3.utils.toWei("10000"), { from: alice })
        await positionManager.sellLongToken(web3.utils.toWei("0.1"), { from: alice })

        const afterBalance = await collateralToken.balanceOf(alice)
        // 379 -> 289
        assert( (Number(web3.utils.fromWei(afterBalance)) - Number(web3.utils.fromWei(beforeBalance))).toFixed(0) , 289 )

    })

    it('short token - index price goes down', async () => {

        if (isMainnet) {
            await collateralToken.approve( reserves.address, web3.utils.toWei("300") , { from : alice })
            await reserves.deposit(collateralToken.address, web3.utils.toWei("300") , { from : alice })

            // Reset index price
            await priceFeed.updateValue(web3.utils.toWei("3000"))

            const sellPrice = await positionManager.getSellPrice(web3.utils.toWei("0.1"))
            assert(Number(web3.utils.fromWei(sellPrice)).toFixed(0), 273)

            const collateral = await positionManager.calculateCollateralShort(web3.utils.toWei("0.1"))

            await positionManager.buyShortToken(web3.utils.toWei("0.1"), collateral, { from: alice })

            const totalShortToken = await shortToken.balanceOf(alice)  
            assert( Number(web3.utils.fromWei(totalShortToken)).toFixed(0) , 272)

            const beforeBalance = await collateralToken.balanceOf(alice)

            // Decrease price from 3500 -> 2500
            await priceFeed.updateValue(web3.utils.toWei("2500"))
            const updatedIndexPrice = await positionManager.getIndexPrice()
            assert(Number(web3.utils.fromWei(updatedIndexPrice)) , 2500 )
            const updatedMidPrice = await positionManager.getMidPrice() 
            assert(Number(web3.utils.fromWei(updatedMidPrice)).toFixed(0) , 2003)
            const buyPrice = await positionManager.getBuyPrice(web3.utils.toWei("0.1"))
            assert(Number(web3.utils.fromWei(buyPrice)).toFixed(0) , 228 )

            await shortToken.approve(positionManager.address, web3.utils.toWei("10000"), { from: alice })
            await positionManager.sellShortToken(totalShortToken , { from: alice })
            
            const afterBalance = await collateralToken.balanceOf(alice)

            // 273 -> 320
            assert( (Number(web3.utils.fromWei(afterBalance)) - Number(web3.utils.fromWei(beforeBalance))).toFixed(0) , 320)
        }

    })

})