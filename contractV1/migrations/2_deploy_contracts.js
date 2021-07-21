const LeveragedTokenManager = artifacts.require('LeveragedTokenManager')
const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')
const SyntheticToken = artifacts.require('SyntheticToken')
const MockToken = artifacts.require('MockToken')
const PriceResolver = artifacts.require('PriceResolver')
const ExchangeCore = artifacts.require('ExchangeCore')
const ExchangePair = artifacts.require('ExchangePair')
const TokenFactory = artifacts.require('TokenFactory')

const fs = require("fs")

module.exports = async (deployer, network, accounts) => {

    let quoteToken
    let priceFeed
    let priceResolver
    let leveragedToken
    let exchangeCore
    let exchangePairLong
    let exchangePairShort
    let tokenFactoryAddress
    let longToken
    let shortToken

    if (network === "kovan" || network === "kovan-fork") {

        const admin = accounts[0]
        const dev = "0x2D4208d1a5B2573476cf1d0f96CB03D15E709E58"

        await deployer.deploy(
            MockToken,
            "Tamago USD",
            "TUSD",
            {
                from: admin
            })

        quoteToken = await MockToken.at(MockToken.address)

        await deployer.deploy(
            ChainlinkPriceFeeder,
            "Tesla Stock",
            "0xb31357d152638fd1ae0853d24b9Ea81dF29E3EF2",
            8,
            {
                from: admin
            })

        await deployer.deploy(
            TokenFactory,
            {
                from: admin
            }
        )

        tokenFactoryAddress = TokenFactory.address

        priceFeed = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            PriceResolver,
            2,
            priceFeed.address,
            web3.utils.toWei("650"),
            web3.utils.toWei("600"),
            dev,
            {
                from: admin
            })

        priceResolver = await PriceResolver.at(PriceResolver.address)

        await priceResolver.init({ from: admin })

        await deployer.deploy(
            LeveragedTokenManager,
            "Tesla 2x Leveraged",
            "tsla-2x",
            2,
            tokenFactoryAddress,
            priceResolver.address,
            quoteToken.address,
            dev,
            {
                from: admin
            })

        leveragedToken = await LeveragedTokenManager.at(LeveragedTokenManager.address)

        longToken = await SyntheticToken.at(await leveragedToken.getLongToken())
        shortToken = await SyntheticToken.at(await leveragedToken.getShortToken())

        const priceFeederLongAddress = await priceResolver.getPriceFeederLong()
        const priceFeederShortAddress = await priceResolver.getPriceFeederShort()

        await deployer.deploy(
            ExchangeCore,
            quoteToken.address,
            dev,
            {
                from: admin
            }
        )

        exchangeCore = await ExchangeCore.at(ExchangeCore.address)

        await deployer.deploy(
            ExchangePair,
            ExchangeCore.address,
            longToken.address,
            priceFeederLongAddress,
            {
                from: admin
            }
        )

        exchangePairLong = await ExchangePair.at(ExchangePair.address)

        await deployer.deploy(
            ExchangePair,
            ExchangeCore.address,
            shortToken.address,
            priceFeederShortAddress,
            {
                from: admin
            }
        )

        exchangePairShort = await ExchangePair.at(ExchangePair.address)

        await leveragedToken.setupPmm(
            exchangePairLong.address,
            exchangePairShort.address
        )

        await exchangeCore.enable()

        await exchangeCore.addPair("Tesla Stock")
        await exchangeCore.setLeveragedTokenAddress(0, 2, exchangePairLong.address, exchangePairShort.address)

        // mint long & short tokens
        await quoteToken.approve(exchangePairLong.address, web3.utils.toWei("100000"), { from: admin })
        await quoteToken.approve(leveragedToken.address, web3.utils.toWei("100000"), { from: admin })
        await longToken.approve(exchangePairLong.address, web3.utils.toWei("100000"), { from: admin })
        await shortToken.approve(exchangePairShort.address, web3.utils.toWei("100000"), { from: admin })

        await leveragedToken.mint(web3.utils.toWei("10000"), { from: admin })

        const totalLongToken = await longToken.balanceOf(admin)
        const totalShortToken = await shortToken.balanceOf(admin)

        // deposit long & short tokens
        await exchangePairLong.depositBase(totalLongToken, { from: admin })
        await exchangePairLong.depositQuote(web3.utils.toWei("10000"), { from: admin })

        await exchangePairShort.depositBase( totalShortToken , { from: admin })

        await fs.writeFileSync(
            "../.env",
            `
    REACT_APP_QUOTE_TOKEN=${quoteToken.address}
    REACT_APP_LEVERAGED_TOKEN_MANAGER_TSLA=${leveragedToken.address}
    REACT_APP_TOKEN_FACTORY=${tokenFactoryAddress}
    REACT_APP_EXCHANGE_CORE=${exchangeCore.address}
    `
        );

    }

}