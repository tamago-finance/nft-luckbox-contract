require("dotenv").config()

require("@openzeppelin/hardhat-upgrades")
require("hardhat-deploy")
require("@nomiclabs/hardhat-etherscan")
require("@nomiclabs/hardhat-waffle")
require("hardhat-gas-reporter")
require("solidity-coverage")

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: {
    timeout: 1200000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: process.env.POLYGON_URL,
      //   blockNumber: 20480699,
      // },
      forking: {
        url: process.env.MAINNET_ARCHIVE_RPC,
        accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
        // blockNumber: 13975629,
      },
    },
    polygon: {
      allowUnlimitedContractSize: true,
      url: process.env.POLYGON_URL,
      accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
    },
    harmony: {
      allowUnlimitedContractSize: true,
      url: "https://rpc.s1.t.hmny.io",
      accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
    },
    bsc: {
      allowUnlimitedContractSize: true,
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
    },
    bscTestnet: {
      allowUnlimitedContractSize: true,
      url: "https://data-seed-prebsc-2-s2.binance.org:8545/",
      accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
    },
    mainnetfork: {
      url: "http://127.0.0.1:8545",
      accounts: [process.env.PRIVATEKEY_DEPLOYER, process.env.PRIVATEKEY_DEV],
      timeout: 500000,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dev: {
      default: 1,
    },
  },
  etherscan: {
    apiKey: process.env.POLYGON_API_KEY,
  },
}
