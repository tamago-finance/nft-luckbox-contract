

export const TOKENS = {
    KOVAN: [
        {
            name: "Apple",
            symbol: "AAPL",
            address : "0xD72C75b795254dEdf463fe06072A30517e8b18B5"
        },
        {
            name: "Tesla Inc.",
            symbol: "TSLA",
            address : "0x12fa74832cCbB7FC4E7160d65533709E0A00C2D6"
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
        collateralToken : "0xB5d2c96E6CbE262C890aEd469C574290bd051E8D"
    },
    LOCAL : {
        collateralToken : process.env.REACT_APP_COLLATERAL_ADDRESS
    }
}