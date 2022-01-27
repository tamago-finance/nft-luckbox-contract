module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  // Chainlink Feeder Address
  const FeederUsdcAddress = "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6"
  const FeederEthAddress = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"

  await deploy("PriceResolver", {
    from: deployer,
    args: [deployer],
    log: true,
  })

  const PriceResolver = await hre.ethers.getContractFactory("PriceResolver")
  const shareToken = await hre.ethers.getContractAt(
    "IPancakePair",
    WETH_USDC_LP_ADDRESS
  )

  const priceResolver = PriceResolver.attach(
    (await deployments.get("PriceResolver")).address
  )

  await deploy("NFTManager", {
    from: deployer,
    args: [
      "Lucky Red Envelope",
      "https://api.tamago.finance/lucky-red-envelope/{id}",
      priceResolver.address,
      shareToken.address,
      hre.ethers.utils.formatBytes32String("WETH-USDC-SHARE"),
      hre.ethers.utils.formatBytes32String("USD"),
      dev,
    ],
    log: true,
  })

  await deploy("ChainlinkPriceFeeder", {
    from: deployer,
    args: ["WETH/USD", FeederEthAddress, 8],
    log: true,
  })

  const FeederWEth = await hre.ethers.getContractFactory("ChainlinkPriceFeeder")
  const feederWEth = await FeederWEth.attach(
    (
      await deployments.get("ChainlinkPriceFeeder")
    ).address
  )

  await deploy("ChainlinkPriceFeeder", {
    from: deployer,
    args: ["USDC/USD", FeederUsdcAddress, 8],
    log: true,
  })

  const FeederUsdc = await hre.ethers.getContractFactory("ChainlinkPriceFeeder")
  const feederUsdc = await FeederUsdc.attach(
    (
      await deployments.get("ChainlinkPriceFeeder")
    ).address
  )

  await deploy("MockPriceFeeder", {
    from: deployer,
    args: ["USD"],
    log: true,
  })

  await deploy("QuickswapLPFeeder", {
    from: deployer,
    args: [
      "WETH-USDC-SHARE",
      WETH_USDC_LP_ADDRESS,
      feederWEth.address,
      18,
      feederUsdc.address,
      6,
    ],
    log: true,
  })

  const FeederUsd = await hre.ethers.getContractFactory("MockPriceFeeder")
  const feederUsd = FeederUsd.attach(
    (await deployments.get("MockPriceFeeder")).address
  )

  let updateTx, estimateGas

  console.log(">> Update updateValue")
  estimateGas = await feederUsd.estimateGas.updateValue(
    hre.ethers.utils.parseEther("1")
  )
  updateTx = await feederUsd.updateValue(hre.ethers.utils.parseEther("1"), {
    gasLimit: estimateGas.add(100000),
  })
  console.log("✅ Done on => ", updateTx.hash)

  // Register price feeder
  console.log(">> Update USDC/USD")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USDC/USD"),
    (
      await deployments.get("ChainlinkPriceFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("0.9998")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USDC/USD"),
    (
      await deployments.get("ChainlinkPriceFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("0.9998"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Update USD")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USD"),
    feederUsd.address,
    false,
    hre.ethers.utils.parseEther("1")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USD"),
    feederUsd.address,
    false,
    hre.ethers.utils.parseEther("1"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Update WETH-USDC-SHARE")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WETH-USDC-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("168814574")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WETH-USDC-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("168814574"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Update WETH/USD")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WETH/USD"),
    feederWEth.address,
    false,
    hre.ethers.utils.parseEther("3000")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WETH/USD"),
    feederWEth.address,
    false,
    hre.ethers.utils.parseEther("3000"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  // NFTManager

  const NFTManager = await hre.ethers.getContractFactory("NFTManager")
  const nftManager = NFTManager.attach(
    (await deployments.get("NFTManager")).address
  )

  console.log(">> Add Ang Bao 100 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Bao 100 USD",
    1,
    hre.ethers.utils.parseEther("100")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Bao 100 USD",
    1,
    hre.ethers.utils.parseEther("100"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Add Ang Bao 10 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Bao 10 USD",
    2,
    hre.ethers.utils.parseEther("10")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Bao 10 USD",
    2,
    hre.ethers.utils.parseEther("10"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Add Ang Bao 1 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Bao 1 USD",
    3,
    hre.ethers.utils.parseEther("1")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Bao 1 USD",
    3,
    hre.ethers.utils.parseEther("1"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Set ready state")
  updateTx = await nftManager.setContractState(1)
  console.log("✅ Done on => ", updateTx.hash)

  const syntheticNftAddress = await nftManager.syntheticNFT()

  console.log(">> Synthetic NFT address")
  console.log(syntheticNftAddress)

  console.log("✅ Done 🦄")
}
module.exports.tags = ["NFTManager"]
