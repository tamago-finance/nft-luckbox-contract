

export const TOKENS = {
    KOVAN: [
        {
            name: "Apple",
            symbol: "AAPL",
            address : "0x382f12C915e1F9410BeF459F59AA76079560438D"
        },
        {
            name: "Tesla Inc.",
            symbol: "TSLA",
            address : "0xb2c47640c77567Af73f9C0FFAC7e2c318d75c7c8"
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
        collateralToken : "0x085aba93F18801D281462454895815AE7ABd8E2b"
    },
    LOCAL : {
        collateralToken : process.env.REACT_APP_COLLATERAL_ADDRESS
    }
}