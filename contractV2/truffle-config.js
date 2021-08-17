const HDWalletProvider = require('@truffle/hdwallet-provider');


module.exports = {

    networks: {
        development: {
            host: "127.0.0.1",     // Localhost (default: none)
            port: 8545,            // Standard Ethereum port (default: none)
            network_id: "*",       // Any network (default: none)
        },
        mumbai:{
            provider: () => new HDWalletProvider("YOUR_KEY", `RPC_NODE_URL`),
            network_id : 80001,
            gas: 8500000,
            gasPrice: 10000000000, 
            confirmations: 1,
            skipDryRun: true
          },
          polygon: {
            provider: () => new HDWalletProvider("YOUR_KEY", `RPC_NODE_URL`),
            network_id : 137,
            gas: 8500000,
            gasPrice: 3100000000, 
            // confirmations: 1,
            skipDryRun: true
          }
    },
    compilers: {
        solc: {
            version: "0.6.12",    // Fetch exact version from solc-bin (default: truffle's version)
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    }
}