module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const TAMG_ADDRESS = "0x53BDA082677a4965C79086D3Fe69A6182d6Af1B8"
  const USDC_ADDRESS = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
  const USDC_TAMG_LP_ADDRESS = "0x197B24748D801419d39021bd1B76b9A609D45e5d"
  const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"

  await deploy("PriceResolver", {
    from: deployer,
    args: [deployer],
    log: true,
  })

  const PriceResolver = await hre.ethers.getContractFactory("PriceResolver")
  const shareToken = await hre.ethers.getContractAt(
    "IPancakePair",
    USDC_TAMG_LP_ADDRESS
  )

  const priceResolver = PriceResolver.attach(
    (await deployments.get("PriceResolver")).address
  )

  await deploy("NFTManager", {
    from: deployer,
    args: [
      "Ang Pow USD",
      "https://api.tamago.finance/angpow/{id}",
      priceResolver.address,
      shareToken.address,
      hre.ethers.utils.formatBytes32String("USDC-TAMG-SHARE"),
      hre.ethers.utils.formatBytes32String("USD"),
      dev,
    ],
    log: true,
  })

  await deploy("ChainlinkPriceFeeder", {
    from: deployer,
    args: ["USDC/USD", "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7", 8],
    log: true,
  })

  await deploy("MockPriceFeeder", {
    from: deployer,
    args: ["USD"],
    log: true,
  })

  await deploy("QuickswapTokenFeeder", {
    from: deployer,
    args: [
      "TAMG/USDC",
      TAMG_ADDRESS,
      18, //TAMG decimals
      USDC_ADDRESS,
      6, // USDC decimals
    ],
    log: true,
  })

  await deploy("QuickswapLPFeeder", {
    from: deployer,
    args: [
      "USDC-TAMG-SHARE",
      USDC_TAMG_LP_ADDRESS,
      (await deployments.get("ChainlinkPriceFeeder")).address,
      6,
      (await deployments.get("QuickswapTokenFeeder")).address,
      18,
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

  console.log(">> Update TAMG/USDC")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("TAMG/USDC"),
    (
      await deployments.get("QuickswapTokenFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("0.4")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("TAMG/USDC"),
    (
      await deployments.get("QuickswapTokenFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("0.4"),
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

  console.log(">> Update USDC-TAMG-SHARE")
  estimateGas = await priceResolver.estimateGas.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USDC-TAMG-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("1380000")
  )
  updateTx = await priceResolver.registerPriceFeeder(
    hre.ethers.utils.formatBytes32String("USDC-TAMG-SHARE"),
    (
      await deployments.get("QuickswapLPFeeder")
    ).address,
    false,
    hre.ethers.utils.parseEther("1380000"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  // NFTManager

  const NFTManager = await hre.ethers.getContractFactory("NFTManager")
  const nftManager = NFTManager.attach(
    (await deployments.get("NFTManager")).address
  )

  console.log(">> Add Ang Pow 100 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Pow 100 USD",
    1,
    hre.ethers.utils.parseEther("100")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Pow 100 USD",
    1,
    hre.ethers.utils.parseEther("100"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Add Ang Pow 10 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Pow 10 USD",
    2,
    hre.ethers.utils.parseEther("10")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Pow 10 USD",
    2,
    hre.ethers.utils.parseEther("10"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Add Ang Pow 1 USD")
  estimateGas = await nftManager.estimateGas.addSyntheticVariant(
    "Ang Pow 1 USD",
    3,
    hre.ethers.utils.parseEther("1")
  )
  updateTx = await nftManager.addSyntheticVariant(
    "Ang Pow 1 USD",
    3,
    hre.ethers.utils.parseEther("1"),
    { gasLimit: estimateGas.add(100000) }
  )
  console.log("✅ Done on => ", updateTx.hash)

  console.log(">> Set ready state")
  updateTx = await nftManager.setContractState(1)
  console.log("✅ Done on => ", updateTx.hash)

  console.log("✅ Done 🦄")
}
module.exports.tags = ["NFTManager"]
