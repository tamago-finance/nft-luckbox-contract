const MockToken = artifacts.require('MockToken')
const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')
const PriceResolver = artifacts.require('PriceResolver')
const TokenFactory = artifacts.require('TokenFactory')
const LeveragedTokenManager = artifacts.require('LeveragedTokenManager')
const SyntheticToken = artifacts.require('SyntheticToken')
const Pmm = artifacts.require('Pmm')


const fs = require("fs")

module.exports = async (deployer, network, accounts) => {

    let quoteTokenInstance
    let priceFeedInstance
    let priceResolverInstance
    let leveragedTokenInstance
    let pmmLongInstance
    let pmmShortInstance

    if (network === "kovan") {

        const admin = accounts[0]

        // await deployer.deploy(
        //     MockToken,
        //     "Tamago USD",
        //     "TUSD",
        //     {
        //         from: admin
        //     })

        // quoteTokenInstance = await MockToken.at(MockToken.address)

        quoteTokenInstance = await MockToken.at("0x5De36B1c96fEf717C5EAD1AA9a68a35b791Ca418")

        // await deployer.deploy(
        //     ChainlinkPriceFeeder,
        //     "Tesla Stock",
        //     "0xb31357d152638fd1ae0853d24b9Ea81dF29E3EF2",
        //     8,
        //     {
        //         from: admin
        //     })

        await deployer.deploy(
            ChainlinkPriceFeeder,
            "Gold",
            "0xc8fb5684f2707C82f28595dEaC017Bfdf44EE9c5",
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

        priceFeedInstance = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            PriceResolver,
            2,
            priceFeedInstance.address,
            web3.utils.toWei("1700"),
            web3.utils.toWei("100"),
            {
                from: admin
            })

        priceResolverInstance = await PriceResolver.at(PriceResolver.address)

        await priceResolverInstance.init()

        await deployer.deploy(
            LeveragedTokenManager,
            "Gold 2x Leveraged",
            "xau-2x",
            2,
            TokenFactory.address,
            priceResolverInstance.address,
            quoteTokenInstance.address,
            {
                from: admin
            })

        leveragedTokenInstance = await LeveragedTokenManager.at(LeveragedTokenManager.address)

        const longTokenInstance = await SyntheticToken.at(await leveragedTokenInstance.getLongToken())
        const shortTokenInstance = await SyntheticToken.at(await leveragedTokenInstance.getShortToken())

        const priceFeederLongAddress = await priceResolverInstance.getPriceFeederLong()
        const priceFeederShortAddress = await priceResolverInstance.getPriceFeederShort()

        await deployer.deploy(
            Pmm,
            TokenFactory.address,
            leveragedTokenInstance.address,
            longTokenInstance.address,
            quoteTokenInstance.address,
            priceFeederLongAddress,
            web3.utils.toWei("0.99"),
            {
                from: admin
            }
        )

        const pmmLongInstance = await Pmm.at(Pmm.address)

        await deployer.deploy(
            Pmm,
            TokenFactory.address,
            leveragedTokenInstance.address,
            shortTokenInstance.address,
            quoteTokenInstance.address,
            priceFeederShortAddress,
            web3.utils.toWei("0.99"),
            {
                from: admin
            })

        const pmmShortInstance = await Pmm.at(Pmm.address)

        await leveragedTokenInstance.setupPmm(
            pmmLongInstance.address,
            pmmShortInstance.address
        )

        await quoteTokenInstance.approve( leveragedTokenInstance.address , web3.utils.toWei("30000") , { from : admin })
        await leveragedTokenInstance.mint(web3.utils.toWei("10000") , { from : admin })

        const totalLongToken = await longTokenInstance.balanceOf(admin)
        const totalShortToken = await shortTokenInstance.balanceOf(admin)

        await longTokenInstance.approve(leveragedTokenInstance.address, web3.utils.toWei("100000") , { from : admin })
        await shortTokenInstance.approve(leveragedTokenInstance.address, web3.utils.toWei("100000"), { from : admin })

        // PMM-long
        await leveragedTokenInstance.addLiquidity(1, totalLongToken , web3.utils.toWei("10000") ,{ from : admin })

        // PMM-short
        await leveragedTokenInstance.addLiquidity(2, totalShortToken , web3.utils.toWei("10000") ,{ from : admin })


        await fs.writeFileSync(
        "../client/.env",
        `
REACT_APP_QUOTE_TOKEN=${quoteTokenInstance.address}
REACT_APP_LEVERAGED_TOKEN_MANAGER_TSLA=${leveragedTokenInstance.address}
`
    );

    }

    

}