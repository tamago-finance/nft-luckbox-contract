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

    if (network === "polygon" ) {

        const TOKEN_FACTORY = "0xd7Dc81E4D199A4a325AA0a7cAaaaC02C26B8AB55"
        const MATIC_TOKEN = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
        const USDC_TOKEN = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"

        // setup price feeders
        await deployer.deploy(
            ChainlinkPriceFeeder,
            "HKD",
            "0x82d43B72573f902F960126a19581BcBbA5b014F5",
            8,
            {
                from: admin,
                chainId: 137
            }
        )

        chainlinkPriceFeeder = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            ChainlinkPriceFeeder,
            "MATIC",
            "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
            8,
            {
                from: admin,
                chainId: 137
            }
        )

        chainlinkPriceFeederCollateral = await ChainlinkPriceFeeder.at(ChainlinkPriceFeeder.address)

        await deployer.deploy(
            PriceResolver,
            chainlinkPriceFeeder.address,
            chainlinkPriceFeederCollateral.address,
            "1500000000000000000",
            admin,
            {
                from: admin,
                chainId: 137
            }
        )

        priceResolver = await PriceResolver.at(PriceResolver.address)

        // setup a minter contract
        await deployer.deploy(
            TokenManager,
            "Synthetic HKD",
            "HKD",
            TOKEN_FACTORY,
            priceResolver.address,
            MATIC_TOKEN,
            USDC_TOKEN,
            admin,
            {
                from: admin,
                chainId: 137
            }
        )

        tokenManager = await TokenManager.at(TokenManager.address)

        const syntheticTokenAddress = await tokenManager.syntheticToken()

        await tokenManager.setContractState(1, { from: admin, chainId: 137 })

        await fs.writeFileSync(
            "../deployments/polygon-synthHKD-contracts.txt",
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