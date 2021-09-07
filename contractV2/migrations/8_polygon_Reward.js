const Reward = artifacts.require('Reward')
const MockToken = artifacts.require('MockToken')

const { ethers } = require("ethers")
const fs = require("fs")


module.exports = async (deployer, network, accounts) => {

    const admin = accounts[0]

    const toEther = (value) => {
        return ethers.utils.parseEther(`${value}`)
    }

    const toUSDC = (value) => {
        return ethers.utils.parseUnits(`${value}`, 6)
    }

    if (network === "polygon") {

        // POOLS TO BE REWARDED
        const USDC_TAMG = "0x197B24748D801419d39021bd1B76b9A609D45e5d"
        const USDC_HKD = "0x5b301158BEAC5F9Bd5F0CedaACd3Eb14F31d777d"
        const HKD_TOKEN = "0xfc48e2670ceebc8021a8cf51f884540ce350cc8a"

        // TAMG TOKEN
        const TAMG_TOKEN = "0x53BDA082677a4965C79086D3Fe69A6182d6Af1B8"

        const DEV_ADDRESS = "0x56E2D31FC6a587f2387844Eb2Ad1779BDFa07a6e"

        const block = await web3.eth.getBlock("latest")
        const currentBlock = block.number

        await deployer.deploy(
            Reward,
            TAMG_TOKEN,
            toEther(0.005), // REWARD PER BLOCK
            currentBlock, // START BLOCK
            DEV_ADDRESS,
            {
                from: admin,
                chainId: 137
            }
        )

        const rewardContract = await Reward.at(Reward.address)
        const tamgContract = await MockToken.at(TAMG_TOKEN)

        // register TAMG/USDC
        await rewardContract.add(
            40,
            USDC_TAMG,
            false,
            {
                from: admin,
                chainId: 137
            }
        )

        // register HKD/USDC
        await rewardContract.add(
            4,
            USDC_HKD,
            false,
            {
                from: admin,
                chainId: 137
            }
        )

        // register HKD
        await rewardContract.add(
            1,
            HKD_TOKEN,
            false,
            {
                from: admin,
                chainId: 137
            }
        )

        await tamgContract.approve(
            rewardContract.address,
            ethers.constants.MaxUint256,
            {
                from: admin,
                chainId: 137
            })

        // supply 10000 TAMG
        await rewardContract.addTamg(
            toEther(10000),
            {
                from: admin,
                chainId: 137
            })

        await fs.writeFileSync(
            "../deployments/polygon-reward-contracts.txt",
            `
        REWARD_ADDRESS=${rewardContract.address}
        `
        );

    }

}