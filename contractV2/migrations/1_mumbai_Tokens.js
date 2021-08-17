const TokenFactory = artifacts.require('TokenFactory')
const MockToken = artifacts.require('MockToken')

const fs = require("fs")

let baseToken
let supportToken

module.exports = async (deployer, network, accounts) => {

    if (network === "mumbai" ) {

        const admin = accounts[0]

        // setup token factory
        await deployer.deploy(
            TokenFactory,
            {
                from: admin,
                chainId : 80001
            }
        )

        // setup collateral tokens
        await deployer.deploy(
            MockToken,
            "Fake Matic Token",
            "MATIC",
            {
                from: admin,
                chainId : 80001
            })

        baseToken = await MockToken.at(MockToken.address)

        await deployer.deploy(
            MockToken,
            "Fake USDC Token",
            "USDC",
            {
                from: admin,
                chainId : 80001
            })

        supportToken = await MockToken.at(MockToken.address)

        await fs.writeFileSync(
            "../deployments/mumbai-baseline-contracts.txt",
            `
    TOKEN_FACTORY=${TokenFactory.address}
    MATIC_TOKEN=${baseToken.address}
    USDC_TOKEN=${supportToken.address}
    `
        );
    }

}