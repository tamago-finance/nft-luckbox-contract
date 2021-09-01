const Tamago = artifacts.require('Tamago')

const { ethers } = require("ethers")
const fs = require("fs")


module.exports = async (deployer, network, accounts) => {

    if (network === "polygon") {

        const admin = accounts[0]

        // setup token factory
        await deployer.deploy(
            Tamago,
            {
                from: admin,
                chainId : 137
            }
        )

        const tamgToken = await Tamago.at(Tamago.address)
  
        // burn 99M
        await tamgToken.transfer("0x0000000000000000000000000000000000000001", ethers.utils.parseEther(`${99 * 1000000}`),
        {
            from : admin,
            chainId : 137
        })

        await fs.writeFileSync(
            "../deployments/polygon-TAMG-contract.txt",
            `
    TAMG_TOKEN=${tamgToken.address}
    `
        );
    }

}