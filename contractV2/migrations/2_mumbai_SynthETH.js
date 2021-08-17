const TokenFactory = artifacts.require('TokenFactory')
const MockToken = artifacts.require('MockToken')
const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')
const PriceResolver = artifacts.require('PriceResolver')
const TokenManager = artifacts.require('TokenManager')

const fs = require("fs")

let chainlinkPriceFeeder
let chainlinkPriceFeederCollateral
let priceResolver
let tokenManager

module.exports = async (deployer, network, accounts) => {

    const admin = accounts[0]

    if (network === "mumbai" ) {

        const TOKEN_FACTORY = "0x4597Daea76DB2d2E895e5448C963C5AD8cBbB2Ba"
        const MATIC_TOKEN = "0x124067b7A2269Fce716664E6Db3AAb53604ab82E"
        const USDC_TOKEN = "0xA61b529dF63a6eB4138e1FF6F753DB6226531012"

        // setup price feeders
        await deployer.deploy(
            ChainlinkPriceFeeder,
            "ETH",
            "0x0715A7794a1dc8e42615F059dD6e406A6594651A",
            8,
            {
                from: admin,
                chainId: 80001
            }
        )

        chainlinkPriceFeeder = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            ChainlinkPriceFeeder,
            "MATIC",
            "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
            8,
            {
                from: admin,
                chainId: 80001
            }
        )

        chainlinkPriceFeederCollateral = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            PriceResolver,
            chainlinkPriceFeeder.address,
            chainlinkPriceFeederCollateral.address,
            "1200000000000000000",
            admin,
            {
                from: admin,
                chainId: 80001
            }
        )

        priceResolver = await PriceResolver.at(PriceResolver.address)

        // setup a minter contract
        await deployer.deploy(
            TokenManager,
            "Synthetic ETH",
            "sETH",
            TOKEN_FACTORY,
            priceResolver.address,
            MATIC_TOKEN,
            USDC_TOKEN,
            admin,
            {
                from: admin,
                chainId: 80001
            }
        )

        tokenManager = await TokenManager.at(TokenManager.address)

        const syntheticTokenAddress = await tokenManager.syntheticToken()

        await tokenManager.setContractState(1, { from: admin, chainId: 80001 })

        await fs.writeFileSync(
            "../deployments/mumbai-synthETH-contracts.txt",
            `
    TOKEN_MANAGER=${tokenManager.address}
    SYNTHETIC_TOKEN=${syntheticTokenAddress}
    PRICE_FEEDER=${chainlinkPriceFeeder.address}
    PRICE_FEEDER_COLLATERAL=${chainlinkPriceFeederCollateral.address}
    PRICE_RESOLVER=${priceResolver.address}
    `
        );

    }

}