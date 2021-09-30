// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat")
const { solidity } = require("ethereum-waffle")
const chai = require("chai")
const { expect } = require("chai")
const { fromEther } = require("./Helpers")

chai.use(solidity)

describe("Timelock", () => {
  beforeEach(async () => {
    ;[deployer, alice, bob, dev, fee] = await ethers.getSigners()

    const Tamg = await ethers.getContractFactory("MockERC20")
    const Timelock = await ethers.getContractFactory("Timelock")
    tamg = await Tamg.deploy(
      `Tamago Token`,
      `Tamg`,
      ethers.utils.parseEther("1000000")
    )
    timelock = await Timelock.deploy(tamg.address)

    tamgAsDeployer = tamg.connect(deployer)
    timelockAsDeployer = timelock.connect(deployer)

    tamgAsDeployer.approve(timelock.address, ethers.constants.MaxUint256)
  })

  context("Check basic parameter", async () => {
    it("should same token", async () => {
      expect(await timelock.lockToken()).to.eq(tamg.address)
    })
  })

  context("When use timelock", async () => {
    it("should revert when add unlockBlock less than block now", async () => {
      await expect(
        timelockAsDeployer.deposit(ethers.utils.parseEther("12000"), 2)
      ).to.be.revertedWith("Invalid given unlockBlock")
    })

    it("should revert when no batchId", async () => {
      await expect(timelockAsDeployer.withdraw(1)).to.be.revertedWith(
        "Invalid given batchId"
      )
    })

    it("should revert when withdraw before unlockblock", async () => {

      const currentBlock = await ethers.provider.getBlockNumber()

      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 100)
      await expect(timelockAsDeployer.withdraw(0)).to.be.revertedWith(
        "You can not withdraw before unlockBlock"
      )
    })

    it("should revert when withdraw already withdrawn batch", async () => {

      let currentBlock = await ethers.provider.getBlockNumber()

      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 100)
      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 30)
      for (let i = 0; i < 20; i++) {
        // random contract call to make block mined
        await tamgAsDeployer.transfer(
          await deployer.getAddress(),
          ethers.utils.parseEther("1")
        )
      }
      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 100)
      
      const releaseBlock = await timelockAsDeployer.getBatchUnlockBlock(1)
      currentBlock = await ethers.provider.getBlockNumber()

      const diff = Number(releaseBlock) - currentBlock
 
      for (let i = 0; i < diff ; i++) {
        await ethers.provider.send('evm_mine');
      }
      
      await timelockAsDeployer.withdraw(1)
      await expect(timelockAsDeployer.withdraw(1)).to.be.revertedWith(
        "Withdraw status is locked"
      )
    })

    it("should deposit work", async () => {

      let currentBlock = await ethers.provider.getBlockNumber()

      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 100)
      expect(await tamg.balanceOf(timelock.address)).to.be.eq(
        ethers.utils.parseEther("1000")
      )
      const [amount, unlockBlock, canWithdraw] = await timelock.batchesInfo(0)
      expect(amount).to.be.eq(ethers.utils.parseEther("1000"))
      expect(unlockBlock).to.be.eq(currentBlock + 100)
      expect(canWithdraw).to.be.eq(true)
    })

    it("should withdraw work", async () => {

      let currentBlock = await ethers.provider.getBlockNumber()

      await timelockAsDeployer.deposit(ethers.utils.parseEther("1000"), currentBlock + 100)
      expect(await tamg.balanceOf(timelock.address)).to.be.eq(
        ethers.utils.parseEther("1000")
      )
      for (let i = 0; i < 50; i++) {
        // random contract call to make block mined
        await tamgAsDeployer.transfer(
          await deployer.getAddress(),
          ethers.utils.parseEther("1")
        )
      }
      const [amount, unlockBlock, canWithdraw] = await timelock.batchesInfo(0)
      expect(amount).to.be.eq(ethers.utils.parseEther("1000"))
      expect(unlockBlock).to.be.eq(currentBlock + 100)
      expect(canWithdraw).to.be.eq(true)

      const releaseBlock = await timelockAsDeployer.getBatchUnlockBlock(0)
      currentBlock = await ethers.provider.getBlockNumber()

      const diff = Number(releaseBlock) - currentBlock
 
      for (let i = 0; i < diff ; i++) {
        await ethers.provider.send('evm_mine');
      }

      await timelockAsDeployer.withdraw(0)
      const [amountAfter, unlockBlockAfter, canWithdrawAfter] =
        await timelock.batchesInfo(0)
      expect(amountAfter).to.be.eq(ethers.utils.parseEther("0"))
      expect(unlockBlockAfter).to.be.eq(0)
      expect(canWithdrawAfter).to.be.eq(false)
    })
  })
})
