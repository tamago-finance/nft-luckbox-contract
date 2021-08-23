const { ethers } = require("hardhat")
const { solidity } = require("ethereum-waffle")
const chai = require("chai")
const { expect } = require("chai")
const { fromEther } = require("./Helpers")

chai.use(solidity)

describe("Reward", () => {
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
    hkd = await Hkd.deploy(`Hkd`, `Hkd`, ethers.utils.parseEther("1000000"))
    await tamg.deployed()
    await tamgUsdc.deployed()
    await hkdUsdc.deployed()
    await hkd.deployed()
    stakingTokens = [tamgUsdc, hkdUsdc, hkd]

    const Reward = await ethers.getContractFactory("Reward")
    reward = await Reward.deploy(
      tamg.address,
      TAMG_PER_BLOCK,
      0,
      await dev.getAddress()
    )
    await reward.deployed()

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

    rewardAsDeployer = reward.connect(deployer)
    rewardAsAlice = reward.connect(alice)
    rewardAsBob = reward.connect(bob)
    rewardAsDev = reward.connect(dev)
  })

  context("when adjust params", async () => {
    it("should add new pool", async () => {
      for (let i = 0; i < stakingTokens.length; i++) {
        await reward.add(100, stakingTokens[i].address, false, {
          from: await deployer.getAddress(),
        })
      }
      expect(await reward.poolLength()).to.eq(stakingTokens.length)
    })
  })

  context("when use pool", async () => {
    it("should revert when there is nothing to be withdraw", async () => {
      await reward.add(100, tamgUsdc.address.toString(), false, {
        from: await deployer.getAddress(),
      })
      await expect(
        reward.withdraw(0, 100, { from: await deployer.getAddress() })
      ).to.be.revertedWith("withdraw: not good")
    })

    it("should revert when that pool is not existed", async () => {
      await expect(
        reward.deposit(100, ethers.utils.parseEther("100"), {
          from: await deployer.getAddress(),
        })
      ).to.be.reverted
    })

    it("should withdraw reawrd from the lp token", async () => {
      // 0. Deployer transfer tamg to reward
      await tamgAsDeployer.transfer(
        reward.address,
        ethers.utils.parseEther("1000000")
      )

      // 1. Mint TamgUsdc for staking
      await tamgUsdcAsDeployer.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )

      // 2. Add TamgUsdc to the reward pool
      await rewardAsDeployer.add(100, tamgUsdc.address, false)

      // 3. Deposit TamgUsdc to the TamgUsdc pool
      await tamgUsdcAsAlice.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsAlice.deposit(0, ethers.utils.parseEther("100"))
      expect(await tamgUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("900")
      )

      // 4. Mine 1 Block
      await rewardAsDeployer.massUpdatePools()

      expect(
        await rewardAsAlice.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("10"))

      // 5. Withdraw all
      // Reward = 20 Tamg => 10 Tamg per block * 2 block are mine
      await rewardAsAlice.withdraw(0, ethers.utils.parseEther("100"))

      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("20")
      )
      expect(await tamgUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("1000")
      )
    })

    it("should distribute rewards according to the alloc point", async () => {
      // 0. Deployer transfer tamg to reward
      await tamgAsDeployer.transfer(
        reward.address,
        ethers.utils.parseEther("1000000")
      )
      // 1. Mint TamgUsdc and HkdUsdc for staking
      await tamgUsdc.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await hkdUsdc.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )

      // 2. Add TamgUsdc and HkdUsdc to the reward
      await rewardAsDeployer.add(100, tamgUsdc.address, false)
      await rewardAsDeployer.add(100, hkdUsdc.address, false)

      // 3. Deposit TamgUsdc to the TamgUsdc pool
      await tamgUsdcAsAlice.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsAlice.deposit(0, ethers.utils.parseEther("100"))

      // 4. Deposit HkdUsdc to the HkdUsdc pool
      await hkdUsdcAsAlice.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsAlice.deposit(1, ethers.utils.parseEther("100"))

      // 4. Mine 1 Block
      await rewardAsDeployer.massUpdatePools()

      expect(await reward.pendingTamg(0, await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("15")
      )
      expect(await reward.pendingTamg(1, await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("5")
      )

      // 5. Withdraw all yield
      await rewardAsAlice.withdraw(0, ethers.utils.parseEther("100"))
      await rewardAsAlice.withdraw(1, ethers.utils.parseEther("100"))

      // Tamg reward should be
      // Pool 0 = 4 block mined * 5 = 20
      // Pool 1 = 3 block mined * 5 = 14
      // Total reward = 20 + 15 = 35
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("35")
      )
      expect(await tamgUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("1000")
      )
      expect(await hkdUsdc.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("1000")
      )
    })

    it("should work when stake all token", async () => {
      // 0. Deployer transfer tamg to reward
      await tamgAsDeployer.transfer(
        reward.address,
        ethers.utils.parseEther("1000000")
      )

      // 1. Mint TamgUsdc, HkdUsdc and hkd for staking to alcie and bob
      await tamgUsdcAsDeployer.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await hkdUsdcAsDeployer.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await hkdUsdcAsDeployer.transfer(
        await alice.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await tamgUsdcAsDeployer.transfer(
        await bob.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await hkdUsdcAsDeployer.transfer(
        await bob.getAddress(),
        ethers.utils.parseEther("1000")
      )
      await hkdUsdcAsDeployer.transfer(
        await bob.getAddress(),
        ethers.utils.parseEther("1000")
      )

      // 2. Add TamgUsdc and HkdUsdc to the reward
      await rewardAsDeployer.add(500, tamgUsdc.address, false)
      await rewardAsDeployer.add(250, hkdUsdc.address, false)
      await rewardAsDeployer.add(250, hkd.address, false)

      await tamgUsdcAsAlice.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsAlice.deposit(0, ethers.utils.parseEther("50"))

      // 3. Trigger random update pool to make 1 more block mine
      await rewardAsDeployer.massUpdatePools()

      // 4. Check pendingTamg reward for Alice
      // Reward pool 0 per block = 500/1000 * 10 = 5 tamg
      // alice reward = 5 * 1 block
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("5"))

      // 5. Trigger random update pool to make 1 more block mine
      await rewardAsDeployer.massUpdatePools()

      // 6. Check pendingTamg reward for Alice
      // alice reward = 5 * 2 block
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("10"))

      // 7. Alice should get 15 tamg when she harvest
      await rewardAsAlice.withdraw(0, ethers.utils.parseEther("0"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("15")
      )

      // 8. Bob come in and join the party
      // 2 blocks are mined here, so Alice should get 10 tamg more
      await tamgUsdcAsBob.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsBob.deposit(0, ethers.utils.parseEther("50"))

      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("10"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("0"))

      // 9. Trigger random update pool to make 1 more block mine
      await rewardAsDeployer.massUpdatePools()

      // 10. Check pendingTamg
      // Reward per Block must now share amoung Bob and Alice (2.5-2.5)
      // Alice should has 12.5 Tamg (10 + 2.5)
      // Bob should has 2.5 Tamg 
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("12.5"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("2.5"))

      // 11. Trigger random update pool to make 1 more block mine
      await rewardAsDeployer.massUpdatePools()

      // 12. Check pendingTamg
      // Reward per Block must now share amoung Bob and Alice (2.5-2.5)
      // Alice should has 15 Tamg (12.5 + 2.5)
      // Bob should has 5 Tamg (2.5 + 2.5)
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("15"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("5"))

      // 13. Bob harvest his yield
      // Reward per Block is till (2.5-2.5) as Bob is not leaving the pool yet
      // Alice should has 17.5 Tamg (15 + 2.5) in pending
      // Bob should has 7.5 Tamg (5 + 2.5) in his account as he harvest it
      await rewardAsBob.withdraw(0, ethers.utils.parseEther("0"))

      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("17.5"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("0"))
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("7.5")
      )

      // 14. Alice wants more Tamg so she deposit 50 tamgUsdc more
      await rewardAsAlice.deposit(0, ethers.utils.parseEther("100"))

      // Alice deposit to the same pool as she already has some tamgUsdc in it
      // Hence, Alice will get auto-harvest
      // Alice should get 20 Tamg back to her account
      // Hence, Alice should has 35 + 20 = 35 Tamg in her account and 0 pending as she harvested
      // Bob should has 10 Tamg in pending
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("0"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("2.5"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("35")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("7.5")
      )

      // 15. Trigger random update pool to make 1 more block mine
      await rewardAsDeployer.massUpdatePools()

      // 1 more block is mined, now Alice shold get 75% and Bob should get 25% of rewards
      // Hence, Alice should get 0 + 3.75 = 3.75 Tamg in pending
      // Bob should get 2.5 + 1.25 = 3.75 Tamg in pending
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("3.75"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("3.75"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("35")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("7.5")
      )

      // 16. Time past very fast, block are mine until btc are world currency
      for (let i = 0; i < 10; i++) {
        // random contract call to make block mined
        await hkdAsDeployer.transfer(
          await deployer.getAddress(),
          ethers.utils.parseEther("1")
        )
      }

      // 10 more block is mined, and Alice shold get 75% and Bob should get 25% of rewards
      // Hence, Alice should get 3.75 + 3.75*10 = 41.25 Tamg in pending
      // Bob should get 3.75 + 1.25*10 = 16.25 Tamg in pending

      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("41.25"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("16.25"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("35")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("7.5")
      )

      // 17. Alice and Bob are harvest all yield
      await rewardAsAlice.withdraw(0, ethers.utils.parseEther("0"))
      await rewardAsBob.withdraw(0, ethers.utils.parseEther("0"))

      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("3.75"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("0"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("80")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("26.25")
      )

      // 18. Alice are deposit pool 1 hkdUsdc
      await hkdUsdcAsAlice.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsAlice.deposit(1, ethers.utils.parseEther("50"))

      await rewardAsDeployer.massUpdatePools()

      // Now as more tamg reward from 2 pool
      // --- Alice
      // --------- pool 0 reward = 3.75 + (3 * 3.75) = 15
      // --------- pool 1 reward = 2.5
      // --- Bob
      // --------- pool 0 reward = 0 + (3 * 1.25) = 3.75
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("15"))
      expect(
        await reward.pendingTamg(1, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("2.5"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("3.75"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("80")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("26.25")
      )

      // 19. Bob are deposit pool 1 hkdUsdc
      await hkdUsdcAsBob.approve(reward.address, ethers.constants.MaxUint256)
      await rewardAsBob.deposit(1, ethers.utils.parseEther("50"))

      await rewardAsDeployer.massUpdatePools()

      // Now as more tamg reward from 2 pool
      // --- Alice
      // --------- pool 0 reward = 15 + (3 * 3.75) = 26.25
      // --------- pool 1 reward = 2.5 + (2 * 2.5) + (1 * 1.25) = 8.75
      // --- Bob
      // --------- pool 0 reward = 3.75 + (3 * 1.25) = 7.5
      // --------- pool 1 reward = 1.25
      expect(
        await reward.pendingTamg(0, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("26.25"))
      expect(
        await reward.pendingTamg(1, await alice.getAddress())
      ).to.be.eq(ethers.utils.parseEther("8.75"))
      expect(
        await reward.pendingTamg(0, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("7.5"))
      expect(
        await reward.pendingTamg(1, await bob.getAddress())
      ).to.be.eq(ethers.utils.parseEther("1.25"))
      expect(await tamg.balanceOf(await alice.getAddress())).to.be.eq(
        ethers.utils.parseEther("80")
      )
      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("26.25")
      )

      // 20. Time past very fast, block are mine until eth are world computer
      for (let i = 0; i < 100; i++) {
        // random contract call to make block mined
        await hkdAsDeployer.transfer(
          await deployer.getAddress(),
          ethers.utils.parseEther("1")
        )
      }

      // Alice and bob are withdraw all asset from reward

      // --- Alice
      // --------- pool 0 deposit = 150
      // --------- pool 1 deposit = 50
      // --- Bob
      // --------- pool 0 deposit = 50
      // --------- pool 1 deposit = 50

      await rewardAsAlice.withdraw(0, ethers.utils.parseEther("150"))
      await rewardAsAlice.withdraw(1, ethers.utils.parseEther("50"))
      
      await rewardAsBob.withdraw(0, ethers.utils.parseEther("50"))
      await rewardAsBob.withdraw(1, ethers.utils.parseEther("50"))

      // Now as more tamg reward from 2 pool
      // --- Alice
      // --------- pool 0 reward = 26.25 + (101 * 3.75) = 405
      // --------- pool 1 reward = 8.75 + (102 * 1.25) = 136.25
      // --------- tamg reward of alice = 80 + 541.25 = 621.15
      // --- Bob
      // --------- pool 0 reward = 7.5 + (101 * 1.25) + (2 * 5) = 143.75
      // --------- pool 1 reward = 1.25 + (102 * 1.25) + (2 * 2.5) = 133.75
      // --------- tamg reward of bob = 26.25 + 143.75 + 133.75 = 303.75

      expect(await tamg.balanceOf(await bob.getAddress())).to.be.eq(
        ethers.utils.parseEther("303.75")
      )
    })
  })
})
