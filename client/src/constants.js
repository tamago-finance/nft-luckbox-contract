

export const TOKENS = {
    KOVAN: [
        {
            name: "Apple",
            symbol: "AAPL",
            address : "0x8ebf1287C448cB96E7A2C3438CBf29194BF98499"
        },
        {
            name: "Tesla Inc.",
            symbol: "TSLA",
            address : "0x75dc396f15E2d0fFFe7CFF1b7869C789895416fe"
        }
    ],
    LOCAL: [
        {
            name: "Apple",
            symbol: "AAPL",
            address : process.env.REACT_APP_APPLE_PERPETUAL_ADDRESS
        },
        {
            name: "Tesla Inc.",
            symbol: "TSLA",
            address : process.env.REACT_APP_TESLA_PERPETUAL_ADDRESS
        }
    ]
}

export const CONTRACTS = {
    KOVAN : {
        collateralToken : "0x443A24CDb74C14e23AdE804C247A92ee1b5Dc4Cb"
    },
    LOCAL : {
        collateralToken : process.env.REACT_APP_COLLATERAL_ADDRESS
    }
}