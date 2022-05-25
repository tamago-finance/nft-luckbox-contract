module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments

  const { deployer, dev } = await getNamedAccounts()

  const nftLuckboxDeployment = "LuckBox"


  _linkToken = "0xa36085F69e2889c224210F603D836748e7dC0088"
  _vrfCoordinator = "0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9"
  _keyHash = "0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4"
  _fee = "100000000000000000" // 0.1 LINK



  const nftLuckboxResult = await deploy(nftLuckboxDeployment, {
    contract: "LuckBoxUpgradeable",
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [_linkToken, _vrfCoordinator, _keyHash, _fee],
      },
    },
    log: true,
    deterministicDeployment: false,
  })

  console.log(`${nftLuckboxDeployment} was deployed`)

  await hre.run("verify:verify", {
    address: nftLuckboxResult.implementation,
    constructorArguments: [],
  })
}

module.exports.tags = ["NFTLuckboxKovan"]
