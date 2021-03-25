const Pmm = artifacts.require('Pmm');
const MockToken = artifacts.require('MockToken')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const Perpetual = artifacts.require('Perpetual')
const SyntheticToken = artifacts.require('SyntheticToken')


let priceFeed
let colleteralToken
let syntheticToken
let pmm
let perpetual

const Side = {
    FLAT: 0,
    SHORT: 1,
    LONG: 2,
}

const Leverage = {
    ONE: 0,
    TWO: 1,
    THREE: 2,
    FOUR: 3
}

contract('Perpetual', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    beforeEach(async () => {

        colleteralToken = await MockToken.new("USD Stablecoin", "USD")
        priceFeed = await PriceFeeder.new("AAPL/USD")

        await colleteralToken.transfer(alice, web3.utils.toWei("10000"))
        await colleteralToken.transfer(bob, web3.utils.toWei("10000"))

        await priceFeed.updateValue(web3.utils.toWei("120"))

        const tokenFactory = await TokenFactory.new()

        perpetual = await Perpetual.new(
            "Apple Stock",
            "AAPL",
            tokenFactory.address,
            priceFeed.address,
            colleteralToken.address
        )

        syntheticToken = await SyntheticToken.at(await perpetual.getTokenCurrency())

        pmm = await Pmm.new(
            tokenFactory.address,
            perpetual.address,
            syntheticToken.address,
            colleteralToken.address,
            priceFeed.address,
            web3.utils.toWei("0.99") // K 
        )

        await colleteralToken.approve(perpetual.address,  web3.utils.toWei("1000000"))
        await perpetual.setupPmm(pmm.address) // mint 1 SYNTH and deposit to PMM

    })


    it('basic add and remove liquidity ', async () => {
        // Adding liquidity
        await colleteralToken.approve(perpetual.address, web3.utils.toWei("1000000"), { from: alice })
        await perpetual.addLiquidity(web3.utils.toWei("5000"), { from: alice })
        const makerData = await perpetual.liquidityProviders(alice)
        // Colleteral token resides at perpertual
        assert(web3.utils.fromWei(await colleteralToken.balanceOf(perpetual.address)), "5000")
        assert(web3.utils.fromWei(makerData.rawCollateral), "5000")
        assert(web3.utils.fromWei(makerData.totalMinted), "42.666666666666666667")

        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).quote), "5000")
        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).availableQuote), "5000")

        // Removing liquidity
        // 50%
        await perpetual.addLiquidity(web3.utils.toWei("0.5"), { from: alice })
        assert(web3.utils.fromWei(makerData.rawCollateral), "2500")
        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).quote), "2500")
        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).availableQuote), "2500")
        // 100%
        await perpetual.addLiquidity(web3.utils.toWei("1"), { from: alice })
        assert(web3.utils.fromWei(makerData.rawCollateral), "0")
        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).quote), "0")
        assert(web3.utils.fromWei((await perpetual.totalLiquidity()).availableQuote), "0")
    })

    it('open a long position with x2 leverage', async () => {
        // Adding liquidity first
        await colleteralToken.approve(perpetual.address, web3.utils.toWei("1000000"), { from: admin })
        await perpetual.addLiquidity(web3.utils.toWei("5000"), { from: admin })

        // Check if we have enough liquidity
        assert(Number(web3.utils.fromWei((await perpetual.totalLiquidity()).availableQuote)) > 400, true)

        await colleteralToken.approve(perpetual.address, web3.utils.toWei("1000000"), { from: alice })

        await perpetual.openLongPosition(web3.utils.toWei("1"), web3.utils.toWei("150"), Leverage.TWO, { from: alice })

        const alicePosition = await perpetual.positions(alice)

        assert(web3.utils.fromWei(alicePosition.rawCollateral), "125.8426229508196722")
        assert(web3.utils.fromWei(alicePosition.leveragedAmount), "251.6852459016393444")
        assert(web3.utils.fromWei(alicePosition.positionSize), "2")
        assert(Number(alicePosition.side), 2)
        assert(Number(alicePosition.leverage), 1)
        assert(web3.utils.fromWei(alicePosition.entryValue) , "125.8426229508196722")
        assert(alicePosition.locked, true)

        // Risen AAPL from 120 -> 135

        console.log("base --> ", web3.utils.fromWei(await syntheticToken.balanceOf(pmm.address)) )
        console.log("quote --> ", web3.utils.fromWei(await colleteralToken.balanceOf(pmm.address)))

        console.log(web3.utils.fromWei(await pmm.querySellBaseToken( web3.utils.toWei("2") ) ))

        await priceFeed.updateValue(web3.utils.toWei("135"))

        console.log(web3.utils.fromWei(await pmm.querySellBaseToken( web3.utils.toWei("2") ) ))

    })


})