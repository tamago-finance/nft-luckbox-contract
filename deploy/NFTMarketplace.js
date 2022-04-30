const { config: getConfig } = require("../constants")
const { toEther } = require("../test/Helpers")

module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const marketPlaceDeployments = "NFTMarketplace"
  const marketPlaceResult = await deploy(marketPlaceDeployments, {
    contract: "NFTMarketplaceUpgradeable",
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [deployer],
      },
    },
    log: true,
    deterministicDeployment: false,
  })

  console.log(`${marketPlaceDeployments} was deployed`)

  console.log("✅ Done 🦄")
}

module.exports.tags = ["NFTMarketplace"]
