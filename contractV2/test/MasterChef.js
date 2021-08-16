const { ethers, upgrades } = require("hardhat")
const { solidity } = require("ethereum-waffle")
const BigNumber = require("bignumber.js")
const chai = require("chai")
const { expect } = require("chai")

chai.use(solidity)

describe("hkd", () => {
  const TAMG_PER_BLOCK = ethers.utils.parseEther("10")

  beforeEach(async () => {
    ;[deployer, alice, bob, dev, fee] = await ethers.getSigners()

    const Tamg = await ethers.getContractFactory("MockERC20")
    const TamgUsdc = await ethers.getContractFactory("MockERC20")
    const HkdUsdc = await ethers.getContractFactory("MockERC20")
    const Hkd = await ethers.getContractFactory("MockERC20")
    tamg = await Tamg.deploy(
      `Tamago Token`,
      `Tamg`,
      ethers.utils.parseEther("1000000")
    )
    tamgUsdc = await TamgUsdc.deploy(
      `Tamago/Usdc LP`,
      `Tamago/Usdc LP`,
      ethers.utils.parseEther("1000000")
    )
    hkdUsdc = await HkdUsdc.deploy(
      `Hkd/Usdc LP`,
      `Hkd/Usdc LP`,
      ethers.utils.parseEther("1000000")
    )
    hkd = await Hkd.deploy(
      `Hkd`,
      `Hkd`,
      ethers.utils.parseEther("1000000")
    )
    await tamg.deployed()
    await tamgUsdc.deployed()
    await hkdUsdc.deployed()
    await hkd.deployed()
    stakingTokens = [tamgUsdc, hkdUsdc, hkd]

    const MasterChef = await ethers.getContractFactory("MasterChef")
    masterChef = await MasterChef.deploy(
      tamg.address,
      await dev.getAddress(),
      TAMG_PER_BLOCK,
      0
    )
    await masterChef.deployed()

    tamgAsDeployer = tamg.connect(deployer)
    tamgAsAlice = tamg.connect(alice)
    tamgAsBob = tamg.connect(bob)
    tamgAsDev = tamg.connect(dev)

    tamgUsdcAsDeployer = tamgUsdc.connect(deployer)
    tamgUsdcAsAlice = tamgUsdc.connect(alice)
    tamgUsdcAsBob = tamgUsdc.connect(bob)
    tamgUsdcAsDev = tamgUsdc.connect(dev)

    hkdUsdcAsDeployer = hkdUsdc.connect(deployer)
    hkdUsdcAsAlice = hkdUsdc.connect(alice)
    hkdUsdcAsBob = hkdUsdc.connect(bob)
    hkdUsdcAsDev = hkdUsdc.connect(dev)

    hkdAsDeployer = hkd.connect(deployer)
    hkdAsAlice = hkd.connect(alice)
    hkdAsBob = hkd.connect(bob)
    hkdAsDev = hkd.connect(dev)

    masterChefAsDeployer = masterChef.connect(deployer)
    masterChefAsAlice = masterChef.connect(alice)
    masterChefAsBob = masterChef.connect(bob)
    masterChefAsDev = masterChef.connect(dev)
  })

  context("when adjust params", async () => {
    it("should add new pool", async () => {
      for (let i = 0; i < stakingTokens.length; i++) {
        await masterChef.add(100, stakingTokens[i].address, false, {
          from: await deployer.getAddress(),
        })
      }
      expect(await masterChef.poolLength()).to.eq(stakingTokens.length)
    })
  })

  context("when use pool", async () => {
    it("should revert when there is nothing to be withdraw", async () => {
      await masterChef.add(
        100,
        tamgUsdc.address.toString(),
        false,
        {
          from: await deployer.getAddress(),
        }
      )
      await expect(
        masterChef.withdraw(0, 100, { from: await deployer.getAddress() })
      ).to.be.revertedWith("withdraw: not good")
    })

    it("should revert when that pool is not existed", async () => {
      await expect(
        masterChef.deposit(
          100,
          ethers.utils.parseEther("100"),
          { from: await deployer.getAddress() }
        )
      ).to.be.reverted
    })

    it("should harvest yield from the position opened by funder", async () => {
      // 0. Deployer transfer tamg to masterChef
      // 1. Mint TamgUsdc for staking
      await tamgUsdcAsDeployer.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )

      // 2. Add TamgUsdc to the masterChef pool
      await masterChefAsDeployer.add(
        100,
        tamgUsdc.address,
        false
      )

      // 3. Deposit TamgUsdc to the TamgUsdc pool
      await tamgUsdcAsAlice.approve(
        masterChef.address,
        ethers.constants.MaxUint256
      )
      await masterChefAsAlice.deposit(
        0,
        ethers.utils.parseEther("100")
      )
      expect(await tamgUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("900")
      )

      // 4. Mine 1 Block
      await masterChefAsDeployer.massUpdatePools()
      expect(
        await masterChefAsAlice.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("10"))

      // 5. Harvest all yield
      await masterChefAsAlice.withdraw(0, ethers.utils.parseEther("100"))

      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("10")
      )
      expect(await tamgUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("1000")
      )
    })

  })
})
