module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const WMATIC_ADDRESS = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
  const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
  const WMATIC_USDC_LP_ADDRESS = "0x6e7a5fafcec6bb1e78bae2a1f0b612012bf14827"
  const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

  await deploy("PriceResolver", {
    from: deployer,
    args: [deployer],
    log: true,
  })

  const PriceResolver = await hre.ethers.getContractFactory("PriceResolver")
  const shareToken = await hre.ethers.getContractAt(
    "IPancakePair",
    WMATIC_USDC_LP_ADDRESS
  )

  const priceResolver = PriceResolver.attach(
    (await deployments.get("PriceResolver")).address
  )

  await deploy("NFTManager", {
    from: deployer,
    args: [
      "Lucky Red Envelope on Polygon",
      "https://api.tamago.finance/lucky-red-envelope/polygon/{id}",
      priceResolver.address,
      shareToken.address,
      hre.ethers.utils.formatBytes32String("WMATIC-USDC-SHARE"),
      hre.ethers.utils.formatBytes32String("USD"),
      dev,
    ],
    log: true,
  })

  await deploy("ChainlinkPriceFeeder", {
    from: deployer,
    args: ["WMATIC/USD", "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", 8],
    log: true,
  })

  const FeederWmatic = await hre.ethers.getContractFactory(
    "ChainlinkPriceFeeder"
  )
  const feederWmatic = await FeederWmatic.attach(
    (
      await deployments.get("ChainlinkPriceFeeder")
    ).address
  )

  await deploy("ChainlinkPriceFeeder", {
    from: deployer,
    args: ["USDC/USD", "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7", 8],
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

  // await deploy("QuickswapTokenFeeder", {
  //   from: deployer,
  //   args: [
  //     "TAMG/USDC",
  //     TAMG_ADDRESS,
  //     18, //TAMG decimals
  //     USDC_ADDRESS,
  //     6, // USDC decimals
  //   ],
  //   log: true,
  // })

  await deploy("QuickswapLPFeeder", {
    from: deployer,
    args: [
      "WMATIC-USDC-SHARE",
      WMATIC_USDC_LP_ADDRESS,
      feederWmatic.address,
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

  // console.log(">> Update TAMG/USDC")
  // estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
  //   hre.ethers.utils.formatBytes32String("TAMG/USDC"),
  //   (
  //     await deployments.get("QuickswapTokenFeeder")
  //   ).address,
  //   false,
  //   hre.ethers.utils.parseEther("0.4")
  // )
  // updateTx = await priceResolver.registerPriceFeeder(
  //   hre.ethers.utils.formatBytes32String("TAMG/USDC"),
  //   (
  //     await deployments.get("QuickswapTokenFeeder")
  //   ).address,
  //   false,
  //   hre.ethers.utils.parseEther("0.4"),
  //   { gasLimit: estimateGas.add(100000) }
  // )
  // console.log("✅ Done on => ", updateTx.hash)

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

  console.log(">> Update WMATIC-USDC-SHARE")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WMATIC-USDC-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("4706278")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WMATIC-USDC-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("4706278"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Update WMATIC/USD")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WMATIC/USD"),
    feederWmatic.address,
    false,
    hre.ethers.utils.parseEther("1.5")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("WMATIC/USD"),
    feederWmatic.address,
    false,
    hre.ethers.utils.parseEther("1.5"),
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
