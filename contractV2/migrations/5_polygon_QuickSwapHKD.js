const PancakeFactory = artifacts.require('IPancakeFactory')
const PancakeRouter = artifacts.require('IPancakeRouter01')
const PancakePair = artifacts.require('IPancakePair')
const MockToken = artifacts.require('MockToken')

const { ethers } = require("ethers")
const fs = require("fs")

let router
let factory
let pair
let baseToken
let pairToken


module.exports = async (deployer, network, accounts) => {

    const admin = accounts[0]

    const toEther = (value) => {
        return ethers.utils.parseEther(`${value}`)
    }
    
    const toUSDC = (value) => {
        return ethers.utils.parseUnits(`${value}`, 6)
    }

    if (network === "polygon") {

        // ERC-20 tokens
        const USDC_TOKEN = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
        const HKD_TOKEN = "0xfc48e2670ceebc8021a8cf51f884540ce350cc8a"
        // Quickswap
        const FACTORY_ADDRESS = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
        const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

        baseToken = await MockToken.at(USDC_TOKEN)
        pairToken = await MockToken.at(HKD_TOKEN)

        router = await PancakeRouter.at(ROUTER_ADDRESS)
        factory = await PancakeFactory.at(FACTORY_ADDRESS)

        const tx = await factory.createPair(baseToken.address, pairToken.address,  { from: admin, chainId: 137 } )
        const pairAddress = tx['logs'][0]['args']['pair']
        pair = await PancakePair.at(pairAddress)

        // first mint
        await baseToken.transfer(pair.address, toUSDC(500) ,  { from: admin, chainId: 137 }) // 500 USDC
        await pairToken.transfer(pair.address, toEther(3900),  { from: admin, chainId: 137 } ) // 3900 HKD = 500 USDC x 7.8 HKD / USD
        await pair.mint(admin,  { from: admin, chainId: 137 } )

        await fs.writeFileSync(
            "../deployments/polygon-quickswap-USDC-HKD-contracts.txt",
            `
    PAIR_ADDRESS=${pair.address}
    `
        );

    }

}
