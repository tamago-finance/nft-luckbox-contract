// TRUFFLE

// const PancakeFactory = artifacts.require('IPancakeFactory')
// const PancakeRouter = artifacts.require('IPancakeRouter01')
// const PancakePair = artifacts.require('IPancakePair')
// const MockToken = artifacts.require('MockToken')
// const Tamago = artifacts.require('Tamago')
// const Reward = artifacts.require('Reward')
// const TokenFactory = artifacts.require('TokenFactory')
// const TokenManager = artifacts.require('TokenManager')
// const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')
// const SyntheticToken = artifacts.require('SyntheticToken')
// const PriceResolver = artifacts.require('PriceResolver')
// const PriceFeeder = artifacts.require('MockPriceFeeder')


// const { expect } = require("chai");
// const { ethers } = require("ethers");
// const { fromEther, toEther } = require("../Helpers")

// let router
// let factory
// let tamgToken
// let baseCollateral
// let supportCollateral
// let tokenFactory
// let chainlinkPriceFeeder
// let chainlinkPriceFeederCollateral
// let priceResolver
// let tokenManager
// let syntheticToken
// let reward

// let usdcHkd
// let usdcTamg

// contract('Full Deployment', (accounts) => {

//     const admin = accounts[0]
//     const alice = accounts[1]
//     const bob = accounts[2]
//     const dev = accounts[3]

//     const FACTORY_ADDRESS = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
//     const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

//     const TAMG_PER_BLOCK = toEther(1)

//     let isPolygon = false

//     before(async () => {

//         try {

//             router = await PancakeRouter.at(ROUTER_ADDRESS)
//             factory = await PancakeFactory.at(FACTORY_ADDRESS)

//             // should be failed if doesn't run on forked polygon
//             const factoryAddress = await router.factory()

//             if (factoryAddress === FACTORY_ADDRESS) {
//                 isPolygon = true
//             }

//             // setup TAMG token
//             tamgToken = await Tamago.new()

//             // setup synthetic system
//             tokenFactory = await TokenFactory.new()

//             wmaticToken = await MockToken.new("Wrapped Matic", "WMATIC")
//             usdcToken = await MockToken.new("USDC", "USDC")

//             chainlinkPriceFeeder = await ChainlinkPriceFeeder.new(
//                 "HKD",
//                 "0x82d43B72573f902F960126a19581BcBbA5b014F5",
//                 8
//             )

//             chainlinkPriceFeederCollateral = await PriceFeeder.new(
//                 "MATIC/USD"
//             )

//             // update value
//             await chainlinkPriceFeederCollateral.updateValue(toEther(1.5));
//             await chainlinkPriceFeederCollateral.setAveragePrice(toEther(1.5));

//             priceResolver = await PriceResolver.new(
//                 chainlinkPriceFeeder.address,
//                 chainlinkPriceFeederCollateral.address,
//                 ethers.utils.parseEther("0.13"),
//                 admin
//             )

//             tokenManager = await TokenManager.new(
//                 "Synthetic HKD",
//                 "sHKD",
//                 tokenFactory.address,
//                 priceResolver.address,
//                 wmaticToken.address,
//                 usdcToken.address,
//                 admin
//             )

//             // make it ready
//             await tokenManager.setContractState(1)

//             const syntheticTokenAddress = await tokenManager.syntheticToken()
//             syntheticToken = await SyntheticToken.at(syntheticTokenAddress)

//             const currentBlock = await web3.eth.getBlockNumber()

//             // setup reward contract
//             reward = await Reward.new(
//                 tamgToken.address,
//                 TAMG_PER_BLOCK,
//                 currentBlock,
//                 dev
//             )

//         } catch (e) {
//             console.log(e)
//         }

//     })

//     it('mint HKD tokens equivalent of $5,000', async () => {

//         if (isPolygon) {

//             const tokenIn = await tokenManager.estimateTokensIn(toEther("39000"))

//             await wmaticToken.approve(tokenManager.address, ethers.constants.MaxUint256)
//             await usdcToken.approve(tokenManager.address, ethers.constants.MaxUint256)

//             // Mint 39,000 sHKD
//             await tokenManager.mint(tokenIn[0], tokenIn[1], toEther("39000"))

//             expect(fromEther((await syntheticToken.balanceOf(admin)).toString())).to.equal("39000.0")
//         }

//     })

//     it('setup all liquidity pools', async () => {

//         if (isPolygon) {

//             // setup USDC/HKD
//             let tx = await factory.createPair(usdcToken.address, syntheticToken.address)
//             let pairAddress = tx['logs'][0]['args']['pair']
//             usdcHkd = await PancakePair.at(pairAddress)

//             await usdcToken.transfer(usdcHkd.address, toEther(1000)) // 1000 USDC
//             await syntheticToken.transfer(usdcHkd.address, toEther(7800)) // 7800 HKD = 1000 USDC x 7.8 HKD / USD
//             await usdcHkd.mint(admin)

//             expect(fromEther((await usdcHkd.balanceOf(admin)).toString())).to.equal("2792.848008753788232976")

//             // setup USDC/TAMG
//             tx = await factory.createPair(usdcToken.address, tamgToken.address)
//             pairAddress = tx['logs'][0]['args']['pair']
//             usdcTamg = await PancakePair.at(pairAddress)

//             await usdcToken.transfer(usdcTamg.address, toEther(1000)) // 1000 USDC
//             await tamgToken.transfer(usdcTamg.address, toEther(2000)) //  2000 TAMG
//             await usdcTamg.mint(admin)

//             expect(fromEther((await usdcTamg.balanceOf(admin)).toString())).to.equal("1414.213562373095047801")

//         }

//     })

//     it('setup reward contract', async () => {

//         if (isPolygon) {

//             // register USDC/TAMG
//             await reward.add(50, usdcTamg.address, false)

//             // register USDC/HKD
//             await reward.add(5, usdcHkd.address, false)

//             // register HKD
//             await reward.add(1, syntheticToken.address, false)

//             expect((await reward.poolLength()).toString()).to.equal("3")

//         }

//     })

//     it('staking all pool by Alice', async () => {

//         if (isPolygon) {

//             // funding 
//             await usdcTamg.transfer(alice, toEther(10))
//             await usdcHkd.transfer(alice, toEther(10))
//             await syntheticToken.transfer(alice, toEther(1000))

//             expect( toEther( await usdcTamg.balanceOf( alice ) )).to.equal("10")
//             expect( toEther( await usdcHkd.balanceOf( alice ) )).to.equal("10")
//             expect( toEther( await syntheticToken.balanceOf( alice ) )).to.equal("1000")

//             await usdcTamg.approve( reward.address , toEther(10000) )
//             await usdcHkd.approve( reward.address , toEther(10000) )
//             await syntheticToken.approve( reward.address , toEther(10000) )

//             await reward.deposit(0, toEther(10))
//             await reward.deposit(1, toEther(10))
//             await reward.deposit(2, toEther(1000))



//         }

//     })

// })