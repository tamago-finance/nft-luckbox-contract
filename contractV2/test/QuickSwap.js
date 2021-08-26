// TRUFFLE

const PancakeFactory = artifacts.require('IPancakeFactory')
const PancakeRouter = artifacts.require('IPancakeRouter01')
const PancakePair = artifacts.require('IPancakePair')
const MockToken = artifacts.require('MockToken')

const { expect } = require("chai");
const { ethers } = require("ethers");
const { fromEther, toEther } = require("./Helpers")

let router
let factory
let baseToken
let pairToken
let pair

contract("QuickSwap", (accounts) => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]
    const dev = accounts[3]

    const FACTORY_ADDRESS = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"
    const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

    let isPolygon = false

    before(async () => {

        try {

            router = await PancakeRouter.at(ROUTER_ADDRESS)
            factory = await PancakeFactory.at(FACTORY_ADDRESS)

            // SETUP TOKENS
            baseToken = await MockToken.new("Token A", "AAA")
            pairToken = await MockToken.new("Token B", "BBB")

            // should be failed if doesn't run on forked polygon
            const factoryAddress = await router.factory()

            if (factoryAddress === FACTORY_ADDRESS) {
                isPolygon = true
            }

        } catch (e) {
            console.log(e)
        }

    })

    it('deploy a pair contract', async () => {

        if (isPolygon) {

            const tx = await factory.createPair(baseToken.address, pairToken.address)
            const pairAddress = tx['logs'][0]['args']['pair']
            pair = await PancakePair.at(pairAddress)

            expect(await pair.factory()).to.equal(FACTORY_ADDRESS)
        }

    })

    it('first mint', async () => {

        if (isPolygon) {

            await baseToken.transfer(pair.address, toEther(1000))
            await pairToken.transfer(pair.address, toEther(2000))
            await pair.mint(admin)

            // const output = await pair.getReserves()

            // expect(fromEther(output[0].toString())).to.equal("1000.0")
            // expect(fromEther(output[1].toString())).to.equal("2000.0")

            expect(fromEther((await pair.balanceOf(admin)).toString())).to.equal("1414.213562373095047801")
        }

    })

    it('add more liquidity through the router', async () => {

        if (isPolygon) {

            await baseToken.approve(router.address, ethers.constants.MaxUint256)
            await pairToken.approve(router.address, ethers.constants.MaxUint256)

            await router.addLiquidity(
                baseToken.address,
                pairToken.address,
                toEther(2000),
                toEther(4000),
                0,
                0,
                admin,
                999999999999999
            )

            // const output = await pair.getReserves()

            // expect(fromEther(output[0].toString())).to.equal("3000.0")
            // expect(fromEther(output[1].toString())).to.equal("6000.0")

            expect( fromEther((await pair.balanceOf(admin)).toString()) ).to.equal("4242.640687119285145403")
        }

    })


    it('swap token A -> token B', async () => {

        if (isPolygon) {

            const baseTokenIn = 10

            const pairTokenOut = await router.getAmountsOut( toEther(baseTokenIn) , [baseToken.address, pairToken.address] )

            await baseToken.transfer(bob , toEther(1000))

            expect( fromEther(pairTokenOut[1].toString())).to.equal("19.873952232082047329")  

            await baseToken.approve(router.address, ethers.constants.MaxUint256, { from : bob })
            await router.swapTokensForExactTokens( pairTokenOut[1], toEther(baseTokenIn),  [baseToken.address, pairToken.address], bob, 999999999999999 , { from : bob} )
            
            expect( fromEther( (await pairToken.balanceOf( bob)).toString() )).to.equal("19.873952232082047329")
        }

    })




})