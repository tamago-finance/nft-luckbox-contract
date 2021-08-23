const { expect } = require("chai");
const { fromEther, toEther } = require("./Helpers")
const { ethers } = require('hardhat');

let reward
let tamgToken
let tamgUsdcToken
let hkdUsdcToken
let hkdToken

let admin
let alice
let bob
let dev


describe("Reward contract #2", () => {

    const TAMG_PER_BLOCK = toEther(10)
    const START_BLOCK = 0

    before(async () => {

        [admin, alice, bob, dev] = await ethers.getSigners();

        const Reward = await ethers.getContractFactory("Reward")
        const MockToken = await ethers.getContractFactory("MockToken");

        // setup TAMG token contract
        tamgToken = await MockToken.deploy("Tamago Token", "TAMG")

        // setup dummy LP contracts
        tamgUsdcToken = await MockToken.deploy("TAMG/USDC Liquidity Pool", "TAMG/USDC")
        hkdUsdcToken = await MockToken.deploy("HKD/USDC Liquidity Pool", "TAMG/USDC")

        // setup synth HKD token contract
        hkdToken = await MockToken.deploy("Synthetic HKD Token", "sHKD")

        reward = await Reward.deploy(
            tamgToken.address,
            TAMG_PER_BLOCK,
            START_BLOCK,
            dev.address
        )

    })

    it('check initial params', async () => {

        expect(await reward.tamg()).to.equal(tamgToken.address)
        expect(await reward.tamgPerBlock()).to.equal(toEther(10))
        expect(await reward.startBlock()).to.equal(START_BLOCK)
        expect(await reward.poolLength()).to.equal(0)

    })

    it('register liquidity pools', async () => {

        // register TAMG/USDC
        await reward.add(100, tamgUsdcToken.address, false)

        // register HKD/USDC
        await reward.add(100, hkdUsdcToken.address, false)

        // register HKD
        await reward.add(100, hkdToken.address, false)

        expect(await reward.poolLength()).to.equal(3)
    })

    it('verify all admin functions are working', async () => {

        await reward.connect(dev).updateTamgPerBlock(toEther(20))

        expect(await reward.tamgPerBlock()).to.equal(toEther(20))
        // revert back
        await reward.connect(dev).updateTamgPerBlock(toEther(10))

        // funding dev some TAMG
        await tamgToken.transfer(dev.address, toEther(10000))
        expect(await tamgToken.balanceOf(dev.address)).to.equal(toEther(10000))

        await tamgToken.connect(dev).approve(reward.address, toEther(10000))

        // deposit reward more
        await reward.connect(dev).addTamg(toEther(10000))
        expect(await tamgToken.balanceOf(dev.address)).to.equal(0)

        // then withdraw it back
        await reward.connect(dev).removeTamg(toEther(10000))
        expect(await tamgToken.balanceOf(dev.address)).to.equal(toEther(10000))
    })

    it('register liquidity pools', async () => {
        // funding a reward conract with 10,000 TAMG    
        await tamgToken.transfer(reward.address, toEther(10000))
        expect(await tamgToken.balanceOf(reward.address)).to.equal(toEther(10000))

        // funding Alice with 10 LP
        await tamgUsdcToken.transfer(alice.address, toEther(10))
        expect(await tamgUsdcToken.balanceOf(alice.address)).to.equal(toEther(10))

        await tamgUsdcToken.connect(alice).approve(reward.address, toEther(10000))

        // deposit 10 LP
        await reward.connect(alice).deposit(0, toEther(10))
        expect(await tamgUsdcToken.balanceOf(alice.address)).to.equal(toEther(0))

        expect(await reward.pendingTamg(0, alice.address)).to.equal(0)

        // Fast-forward 3 blocks
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');

        expect(await reward.pendingTamg(0, alice.address)).to.equal(toEther(10.0))

        await reward.connect(alice).withdraw(0, toEther(10))
 
        expect( await tamgToken.balanceOf(alice.address) ).to.equal(toEther(13.33333333333))
    })

    // TODO : More complex tests

})