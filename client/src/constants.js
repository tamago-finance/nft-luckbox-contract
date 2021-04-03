

export const TOKENS = {
    KOVAN: [
        {
            name: "Apple",
            symbol: "AAPL",
            address : "0x004f87A0B16dCDAD073FA83f2950eebc89d9A076"
        },
        {
            name: "Tesla Inc.",
            symbol: "TSLA",
            address : "0x0C23DCB25E9Cb71ec950c12A2CE334463a289277"
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
        collateralToken : "0x47E66003ba5914bBc2E03Cd3b29bC5b6F6577e41"
    },
    LOCAL : {
        collateralToken : process.env.REACT_APP_COLLATERAL_ADDRESS
    }
}