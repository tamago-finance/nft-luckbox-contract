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

        [admin, alice, bob, charlie, dev] = await ethers.getSigners();

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

    it('simple staking /w single staker and one registered pool', async () => {
        // funding a reward contract with 1,000,000 TAMG    
        await tamgToken.transfer(reward.address, toEther(1000000))
        expect(await tamgToken.balanceOf(reward.address)).to.equal(toEther(1000000))

        // funding Alice with 10 LP
        await tamgUsdcToken.transfer(alice.address, toEther(10))
        expect(await tamgUsdcToken.balanceOf(alice.address)).to.equal(toEther(10))

        await tamgUsdcToken.connect(alice).approve(reward.address, toEther(10000))

        // deposit 10 LP
        await reward.connect(alice).deposit(0, toEther(10))
        expect(await tamgUsdcToken.balanceOf(alice.address)).to.equal(toEther(0))

        expect(await reward.pendingTamg(0, alice.address)).to.equal(0)

        const blockBefore = await ethers.provider.getBlockNumber();

        // Fast-forward 3 blocks
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');

        const blockAfter = await ethers.provider.getBlockNumber()

        expect( blockAfter - blockBefore).to.equal(3)

        // 3 blocks x ((10 rewards / block) / 3 pools) = 10.0
        expect(await reward.pendingTamg(0, alice.address)).to.equal(toEther(10.0))

        await reward.connect(alice).withdraw(0, toEther(10))
 
        expect( await tamgToken.balanceOf(alice.address) ).to.equal(toEther(13.33333333333))
    })

    it('complex staking /w 3 stakers and 3 registered pools', async () => {

        // check allocation for TAMG/USDC pool
        let tamgUsdPoolInfo = await reward.poolInfo(0)
        expect( tamgUsdPoolInfo[1].toString() ).to.equal("100")
 
        let totalAllocationPoint = await reward.totalAllocPoint()
        expect( totalAllocationPoint.toString() ).to.equal("300")
 
        // update allocation points into 70% TAMG/USD, 20% HKD/USD, 10% HKD
        await reward.connect(dev).set(0, 70, false)
        await reward.connect(dev).set(1, 20, false)
        await reward.connect(dev).set(2, 10, false)

        // make sure they're all updated
        tamgUsdPoolInfo = await reward.poolInfo(0)
        let hkdUsdPoolInfo = await reward.poolInfo(1)
        let hkdPoolInfo = await reward.poolInfo(2)

        expect( tamgUsdPoolInfo[1].toString() ).to.equal("70")
        expect( hkdUsdPoolInfo[1].toString() ).to.equal("20")
        expect( hkdPoolInfo[1].toString() ).to.equal("10")

        totalAllocationPoint = await reward.totalAllocPoint()
        expect( totalAllocationPoint.toString() ).to.equal("100")

        // TAMG/USDC
        // funding
        await tamgUsdcToken.transfer(bob.address, toEther(10))
        expect(await tamgUsdcToken.balanceOf(bob.address)).to.equal(toEther(10))
        await tamgUsdcToken.transfer(charlie.address, toEther(10))
        expect(await tamgUsdcToken.balanceOf(charlie.address)).to.equal(toEther(10))

        await tamgUsdcToken.connect(bob).approve(reward.address, toEther(10000))
        await tamgUsdcToken.connect(charlie).approve(reward.address, toEther(10000))

        // deposit 1,2,3 LP
        await reward.connect(alice).deposit(0, toEther(1))
        await reward.connect(bob).deposit(0, toEther(2))
        await reward.connect(charlie).deposit(0, toEther(3))

        // HKD/USDC
        // funding
        await hkdUsdcToken.transfer(alice.address, toEther(10))
        expect(await hkdUsdcToken.balanceOf(alice.address)).to.equal(toEther(10))
        await hkdUsdcToken.transfer(bob.address, toEther(10))
        expect(await hkdUsdcToken.balanceOf(bob.address)).to.equal(toEther(10))
        await hkdUsdcToken.transfer(charlie.address, toEther(10))
        expect(await hkdUsdcToken.balanceOf(charlie.address)).to.equal(toEther(10))

        await hkdUsdcToken.connect(alice).approve(reward.address, toEther(10000))
        await hkdUsdcToken.connect(bob).approve(reward.address, toEther(10000))
        await hkdUsdcToken.connect(charlie).approve(reward.address, toEther(10000))

        // deposit 1,2,3 LP
        await reward.connect(alice).deposit(1, toEther(1))
        await reward.connect(bob).deposit(1, toEther(2))
        await reward.connect(charlie).deposit(1, toEther(3))

        // HKD
        // funding
        await hkdToken.transfer(alice.address, toEther(10000))
        expect(await hkdToken.balanceOf(alice.address)).to.equal(toEther(10000))
        await hkdToken.transfer(bob.address, toEther(10000))
        expect(await hkdToken.balanceOf(bob.address)).to.equal(toEther(10000))
        await hkdToken.transfer(charlie.address, toEther(10000))
        expect(await hkdToken.balanceOf(charlie.address)).to.equal(toEther(10000))

        await hkdToken.connect(alice).approve(reward.address, toEther(10000))
        await hkdToken.connect(bob).approve(reward.address, toEther(10000))
        await hkdToken.connect(charlie).approve(reward.address, toEther(10000))

        // deposit 1000,2000,3000 HKD
        await reward.connect(alice).deposit(2, toEther(1000))
        await reward.connect(bob).deposit(2, toEther(2000))
        await reward.connect(charlie).deposit(2, toEther(3000))

        const blockBefore = await ethers.provider.getBlockNumber();

        let blockCount = 0

        // Fast-forward 1 day = 28800 blocks

        while (true) {
            await ethers.provider.send('evm_mine');
            blockCount += 1
            if (blockCount === 28800) {
                break;
            }
        }

        const blockAfter = await ethers.provider.getBlockNumber()

        expect( blockAfter - blockBefore).to.equal(28800)
 
        // prepare claiming
        expect( fromEther(await reward.pendingTamg(0, alice.address)) ).to.equal("33630.333333333333")
        expect( fromEther(await reward.pendingTamg(0, bob.address)) ).to.equal("67246.666666666666")
        expect( fromEther(await reward.pendingTamg(0, charlie.address)) ).to.equal("100863.0")

        expect( fromEther(await reward.pendingTamg(1, alice.address)) ).to.equal("9605.666666666666")
        expect( fromEther(await reward.pendingTamg(1, bob.address)) ).to.equal("19207.333333333332")
        expect( fromEther(await reward.pendingTamg(1, charlie.address)) ).to.equal("28809.0")

        expect( fromEther(await reward.pendingTamg(2, alice.address)) ).to.equal("4801.333333333")
        expect( fromEther(await reward.pendingTamg(2, bob.address)) ).to.equal("9600.666666666")
        expect( fromEther(await reward.pendingTamg(2, charlie.address)) ).to.equal("14400.0")

        // claiming
        await reward.connect(alice).withdraw(0, toEther(1))
        await reward.connect(bob).withdraw(0, toEther(2))
        await reward.connect(charlie).withdraw(0, toEther(3))

        await reward.connect(alice).withdraw(1, toEther(1))
        await reward.connect(bob).withdraw(1, toEther(2))
        await reward.connect(charlie).withdraw(1, toEther(3))

        await reward.connect(alice).withdraw(2, toEther(1000))
        await reward.connect(bob).withdraw(2, toEther(2000))
        await reward.connect(charlie).withdraw(2, toEther(3000))

        // check only TAMG
        // 33630 + 9605 + 4801
        expect(fromEther( await tamgToken.balanceOf( alice.address ) ) ).to.equal("48054.333333332328")
        // 67246 + 19207 + 9600
        expect(fromEther( await tamgToken.balanceOf( bob.address ) ) ).to.equal("96065.999999997996")
        // 100863 + 28809 + 14400
        expect(fromEther( await tamgToken.balanceOf( charlie.address ) ) ).to.equal("144098.999999996994")

    })

})