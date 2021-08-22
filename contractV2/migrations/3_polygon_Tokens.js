const TokenFactory = artifacts.require('TokenFactory')


const fs = require("fs")

module.exports = async (deployer, network, accounts) => {

    if (network === "polygon") {

        const admin = accounts[0]

        // setup token factory
        await deployer.deploy(
            TokenFactory,
            {
                from: admin,
                chainId : 137
            }
        )

        await fs.writeFileSync(
            "../deployments/polygon-baseline-contracts.txt",
            `
    TOKEN_FACTORY=${TokenFactory.address}
    `
        );
    }

}