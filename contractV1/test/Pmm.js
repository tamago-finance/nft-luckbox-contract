const Pmm = artifacts.require('Pmm')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const MockToken = artifacts.require('MockToken')
const SyntheticToken = artifacts.require('SyntheticToken')

let priceFeed
let pmm
let baseToken
let quoteToken
let baseCapitalToken
let quoteCapitalToken

contract('Pmm', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    beforeEach(async () => {

        baseToken = await MockToken.new("Test Synthetic", "TEST")
        quoteToken = await MockToken.new("USD Stablecoin", "USD")
        priceFeed = await PriceFeeder.new("TEST/USD")

        await baseToken.transfer(alice, web3.utils.toWei("100"))
        await baseToken.transfer(bob, web3.utils.toWei("100"))
        await quoteToken.transfer(alice, web3.utils.toWei("100000"))
        await quoteToken.transfer(bob, web3.utils.toWei("100000"))

        await priceFeed.updateValue(web3.utils.toWei("100"))

        const tokenFactory = await TokenFactory.new()

        pmm = await Pmm.new(
            tokenFactory.address,
            "0x0000000000000000000000000000000000000001",
            baseToken.address,
            quoteToken.address,
            priceFeed.address,
            web3.utils.toWei("0.99") // K 
        )

        // Add Alice, Bob to the whitelist
        await pmm.addAddress(alice)
        await pmm.addAddress(bob)

        const baseCapitalTokenAddress = await pmm.baseCapitalToken()
        const quoteCapitalTokenAddress = await pmm.quoteCapitalToken()

        baseCapitalToken = await SyntheticToken.at(baseCapitalTokenAddress)
        quoteCapitalToken = await SyntheticToken.at(quoteCapitalTokenAddress)

    })

    it('Add/remove liquidity to/from PMM', async () => {
        
        // Admin make a deposit first
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositBase(web3.utils.toWei("100"))
        await quoteToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositQuote(web3.utils.toWei("10000"))

        // Then Alice make a deposit
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"), { from: alice })
        await pmm.depositBase(web3.utils.toWei("10"), { from: alice })
        await quoteToken.approve(pmm.address, web3.utils.toWei("1000000"), { from: alice })
        await pmm.depositQuote(web3.utils.toWei("1000"), { from: alice })

        assert(web3.utils.fromWei(await baseCapitalToken.balanceOf(alice)), "10")
        assert(web3.utils.fromWei(await quoteCapitalToken.balanceOf(alice)), "1000")

        // Withdraw Liquidity
        await baseCapitalToken.approve(pmm.address, web3.utils.toWei("1000000"), { from: alice })
        await pmm.withdrawBase(web3.utils.toWei("5"), { from: alice })
        await quoteCapitalToken.approve(pmm.address, web3.utils.toWei("1000000"), { from: alice })
        await pmm.withdrawQuote(web3.utils.toWei("500"), { from: alice })

        assert(web3.utils.fromWei(await baseCapitalToken.balanceOf(alice)), "5")
        assert(web3.utils.fromWei(await quoteCapitalToken.balanceOf(alice)), "500")
    
    })

    it('Buy base token from PMM', async () => {
        // Deposit 100 TEST to PMM
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositBase(web3.utils.toWei("100"))
        // Deposit 10000 USD to PMM
        await quoteToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositQuote(web3.utils.toWei("10000"))

        const aliceOriginalBalance = await quoteToken.balanceOf(alice)

        // Buy 5 TEST
        await quoteToken.approve(pmm.address, web3.utils.toWei("100000"), { from: alice })
        await pmm.buyBaseToken(web3.utils.toWei("5"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceFirstTrade = await quoteToken.balanceOf(alice)
        assert(Number(web3.utils.fromWei(aliceOriginalBalance)) - Number(web3.utils.fromWei(aliceBalanceFirstTrade)), 526.0526315789466) // avg price = 105.2

        // Buy another 5 TEST
        await pmm.buyBaseToken(web3.utils.toWei("5"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceSecondTrade = await quoteToken.balanceOf(alice)
        assert(Number(web3.utils.fromWei(aliceBalanceFirstTrade)) - Number(web3.utils.fromWei(aliceBalanceSecondTrade)), 583.9473684210534) // avg price = 116.78
    })

    it('Sell base token from PMM', async () => {

        // Deposit 100 TEST to PMM
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositBase(web3.utils.toWei("100"))
        // Deposit 10000 USD to PMM
        await quoteToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositQuote(web3.utils.toWei("10000"))

        const aliceOriginalBalance = await quoteToken.balanceOf(alice)

        // Sell 1 TEST
        await baseToken.approve(pmm.address, web3.utils.toWei("100000"), { from: alice })
        await pmm.sellBaseToken(web3.utils.toWei("1"), web3.utils.toWei("0"), { from: alice })
        const aliceBalanceFirstTrade = await quoteToken.balanceOf(alice)

        assert(Number(web3.utils.fromWei(aliceBalanceFirstTrade)) - Number(web3.utils.fromWei(aliceOriginalBalance)), 99.01960879497614865) // avg price 99.01

        // Sell another 5 TEST
        await pmm.sellBaseToken(web3.utils.toWei("5"), web3.utils.toWei("0"), { from: alice })
        const aliceBalanceSecondTrade = await quoteToken.balanceOf(alice)

        assert(Number(web3.utils.fromWei(aliceBalanceSecondTrade)) - Number(web3.utils.fromWei(aliceBalanceFirstTrade)), 467.32071324311255) // avg price 93.4

    })

    it('Buy base token and then sell when price is increased', async () => {
        // TEST/USD -> 100
        await priceFeed.updateValue(web3.utils.toWei("100"))

        // Deposit 10 TEST to PMM
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositBase(web3.utils.toWei("100"))
        // Deposit 1000 USD to PMM
        await quoteToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositQuote(web3.utils.toWei("10000"))

        const aliceOriginalBalance = await quoteToken.balanceOf(alice)

        // Buy 1 TEST
        await quoteToken.approve(pmm.address, web3.utils.toWei("100000"), { from: alice })
        await pmm.buyBaseToken(web3.utils.toWei("1"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceFirstTrade = await quoteToken.balanceOf(alice)

        assert(Number(web3.utils.fromWei(aliceOriginalBalance)) - Number(web3.utils.fromWei(aliceBalanceFirstTrade)), 101)  // buy at 101

        // TEST/USD -> 120
        await priceFeed.updateValue(web3.utils.toWei("120"))

        // Sell 1 TEST
        await baseToken.approve(pmm.address, web3.utils.toWei("100000"), { from: alice })
        await pmm.sellBaseToken(web3.utils.toWei("1"), web3.utils.toWei("0"), { from: alice })
        const aliceBalanceSecondTrade = await quoteToken.balanceOf(alice)

        assert(Number(web3.utils.fromWei(aliceBalanceSecondTrade)) - Number(web3.utils.fromWei(aliceBalanceFirstTrade)), 120.79718986527587) // sell at 120.79718986527587

    })

    it('Buy base token from one-side funded PMM', async () => {
        // Set TEST/USD to 10
        await priceFeed.updateValue(web3.utils.toWei("10"))

        // Deposit 10000 TEST to PMM
        await baseToken.approve(pmm.address, web3.utils.toWei("1000000"))
        await pmm.depositBase(web3.utils.toWei("10000"))

        const aliceOriginalBalance = await quoteToken.balanceOf(alice)
        assert(web3.utils.fromWei(aliceOriginalBalance), "100000")

        // 10% depth
        await quoteToken.approve(pmm.address, web3.utils.toWei("100000"), { from: alice })
        await pmm.buyBaseToken(web3.utils.toWei("1000"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceFirstTrade = await quoteToken.balanceOf(alice)
        assert(web3.utils.fromWei(await baseToken.balanceOf(alice)), "1000")
        assert(Number(web3.utils.fromWei(aliceOriginalBalance)) - Number(web3.utils.fromWei(aliceBalanceFirstTrade)), 11100) // avg price = 11.1

        // 20% depth
        await pmm.buyBaseToken(web3.utils.toWei("1000"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceSecondTrade = await quoteToken.balanceOf(alice)
        assert(web3.utils.fromWei(await baseToken.balanceOf(alice)), "2000")
        assert(Number(web3.utils.fromWei(aliceBalanceFirstTrade)) - Number(web3.utils.fromWei(aliceBalanceSecondTrade)), 13850) // avg price 13.85

        // 50% depth
        await pmm.buyBaseToken(web3.utils.toWei("3000"), web3.utils.toWei("100000"), { from: alice })
        const aliceBalanceThirdTrade = await quoteToken.balanceOf(alice)
        assert(web3.utils.fromWei(await baseToken.balanceOf(alice)), "5000")
        assert(Number(web3.utils.fromWei(aliceBalanceSecondTrade)) - Number(web3.utils.fromWei(aliceBalanceThirdTrade)), 74550) // avg price 24.85

    });

})