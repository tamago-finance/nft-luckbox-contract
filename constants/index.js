const { ethers } = require("ethers")

const config = {
  mainnet: {
    token: {
      base: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        name: "WETH",
        decimals: 18,
      },
      quote: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        name: "USDC",
        decimals: 6,
      },
      lp: {
        address: "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0",
        name: "WETH-USDC-SHARE",
      },
    },
    priceFeed: {
      base: {
        address: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
        name: "WETH/USD",
        decimals: 8,
        fallback: ethers.utils.parseEther("3000"),
      },
      quote: {
        address: "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6",
        name: "USDC/USD",
        decimals: 8,
        fallback: ethers.utils.parseEther("1"),
      },
      lp: {
        name: "WETH-USDC-SHARE",
        fallback: ethers.utils.parseEther("1"),
      },
    },
    nft: {
      name: "Lucky Red Envelope",
      tokenURI: "https://api.tamago.finance/lucky-red-envelope/{id}",
      lpSymbol: "WETH-USDC-SHARE",
      syntheticSymbol: "USD",
      list: [
        {
          tokenId: 1,
          name: "Ang Bao 100 USD",
          price: ethers.utils.parseEther("100"),
        },
        {
          tokenId: 2,
          name: "Ang Bao 10 USD",
          price: ethers.utils.parseEther("10"),
        },
        {
          tokenId: 3,
          name: "Ang Bao 1 USD",
          price: ethers.utils.parseEther("1"),
        },
      ],
    },
  },
	bsc: {
    token: {
      base: {
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        name: "WBNB",
        decimals: 18,
      },
      quote: {
        address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        name: "BUSD",
        decimals: 18,
      },
      lp: {
        address: "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
        name: "WBNB-BUSD-SHARE",
      },
    },
    priceFeed: {
      base: {
        address: "0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee",
        name: "WBNB/USD",
        decimals: 8,
        fallback: ethers.utils.parseEther("3000"),
      },
      quote: {
        address: "0xcbb98864ef56e9042e7d2efef76141f15731b82f",
        name: "BUSD/USD",
        decimals: 8,
        fallback: ethers.utils.parseEther("1"),
      },
      lp: {
        name: "WETH-USDC-SHARE",
        fallback: ethers.utils.parseEther("1"),
      },
    },
    nft: {
      name: "Lucky Red Envelope",
      tokenURI: "https://api.tamago.finance/lucky-red-envelope/{id}",
      lpSymbol: "WETH-USDC-SHARE",
      syntheticSymbol: "USD",
      list: [
        {
          tokenId: 1,
          name: "Ang Bao 100 USD",
          price: ethers.utils.parseEther("100"),
        },
        {
          tokenId: 2,
          name: "Ang Bao 10 USD",
          price: ethers.utils.parseEther("10"),
        },
        {
          tokenId: 3,
          name: "Ang Bao 1 USD",
          price: ethers.utils.parseEther("1"),
        },
      ],
    },
  },
}

module.exports = {
  config,
}
