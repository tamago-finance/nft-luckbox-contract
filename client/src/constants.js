export const TOKENS = {
  ACALA: [
    {
      name: "Ren Bitcoin",
      symbol: "renBTC",
      address: "0xfE3a0EC3b62B8a8bCC7f8333856c0F64c1cF5223",
    },
    {
      name: "Polkadot",
      symbol: "DOT",
      address: "0xBBE267F15e1b991dA988A5c04d840e50c8d6D72A",
    },
  ],
  KOVAN: [
    {
      name: "Apple",
      symbol: "AAPL",
      address: "0x8ebf1287C448cB96E7A2C3438CBf29194BF98499",
    },
    {
      name: "Tesla Inc.",
      symbol: "TSLA",
      address: "0x75dc396f15E2d0fFFe7CFF1b7869C789895416fe",
    },
  ],
  LOCAL: [
    {
      name: "Apple",
      symbol: "AAPL",
      address: process.env.REACT_APP_APPLE_PERPETUAL_ADDRESS,
    },
    {
      name: "Tesla Inc.",
      symbol: "TSLA",
      address: process.env.REACT_APP_TESLA_PERPETUAL_ADDRESS,
    },
  ],
}

export const CONTRACTS = {
  ACALA: {
    collateralToken: "0x867af5013cD0E54cb9B67035fDcc717488Cfcb6C",
  },
  KOVAN: {
    collateralToken: "0x443A24CDb74C14e23AdE804C247A92ee1b5Dc4Cb",
  },
  LOCAL: {
    collateralToken: process.env.REACT_APP_COLLATERAL_ADDRESS,
  },
}
