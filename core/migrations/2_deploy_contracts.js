const Pmm = artifacts.require('Pmm')
const MockToken = artifacts.require('MockToken')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const Perpetual = artifacts.require('Perpetual')
const SyntheticToken = artifacts.require('SyntheticToken')

const fs = require("fs")

module.exports = async (deployer, network, accounts) => {

    const deployToken = async (collateralTokenAddress, feederName, feederInitialValue , tokenFactoryAddress, tokenName, tokenSymbol, initialFund) => {

        const colleteralToken = await MockToken.at(collateralTokenAddress)

        // Setup Price Feeder
        await deployer.deploy(
            PriceFeeder,
            feederName,
            {
                from: accounts[0]
            })
        
        const priceFeederInstance = await PriceFeeder.at(PriceFeeder.address)
        
        await priceFeederInstance.updateValue(web3.utils.toWei(`${feederInitialValue}`), { from : accounts[0]})
        
        // Setup a perpetual contract
        await deployer.deploy(
            Perpetual,
            tokenName,
            tokenSymbol,
            tokenFactoryAddress,
            PriceFeeder.address,
            collateralTokenAddress,
            {
                from: accounts[0]
            })

        const perpetualInstance = await Perpetual.at(Perpetual.address)
        const syntheticTokenAddress = await perpetualInstance.getTokenCurrency()

        // Setup PMM contract
        await deployer.deploy(
            Pmm,
            tokenFactoryAddress,
            Perpetual.address,
            syntheticTokenAddress,
            collateralTokenAddress,
            PriceFeeder.address,
            web3.utils.toWei("0.99"),
            {
                from: accounts[0]
            })
 
        await colleteralToken.approve( Perpetual.address, web3.utils.toWei("1000000") , { from : accounts[0]})
        await perpetualInstance.setupPmm(Pmm.address)
        // Add liquidity
        await perpetualInstance.addLiquidity( web3.utils.toWei(`${initialFund}`) , { from : accounts[0]})
        
        return Perpetual.address
    }

    if (network === "development" || network === "kovan" || network === "bscTestnet") {

        const admin = accounts[0]

        // Setup account factory
        await deployer.deploy(TokenFactory, {
            from: admin
        })
        // Setup Colleteral Token
        await deployer.deploy(
            MockToken,
            "USD Stablecoin",
            "USDX",
            {
                from: admin
            })
        
        const applePerpetualAddress = await deployToken(MockToken.address, "AAPL/USD", 120, TokenFactory.address, "Apple Stock", "AAPL", 5000)
        const teslaPerpetualAddress = await deployToken(MockToken.address, "TSLA/USD", 600, TokenFactory.address, "Tesla Stock", "TSLA", 7000)
        
        await fs.writeFileSync(
            "../client/.env",
`
REACT_APP_APPLE_PERPETUAL_ADDRESS=${applePerpetualAddress}
REACT_APP_TESLA_PERPETUAL_ADDRESS=${teslaPerpetualAddress}
REACT_APP_COLLATERAL_ADDRESS=${MockToken.address}
`
        );

    }

}