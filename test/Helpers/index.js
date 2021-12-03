const { ethers } = require("ethers")

exports.fromEther = (value) => {
    return ethers.utils.formatEther(value)
}

exports.toEther = (value) => {
    return ethers.utils.parseEther(`${value}`)
}

exports.deployPriceResolverMock = async ({ PriceResolver, MockPriceFeeder, admin }) => {

    const priceResolver = await PriceResolver.deploy(admin.address);

    const feederUsdc = await MockPriceFeeder.deploy("USDC/USD");
    const feederTamg = await MockPriceFeeder.deploy("TAMG/USD");
    const feederUsd = await MockPriceFeeder.deploy("USD");
    const feederUsdcTamgShare = await MockPriceFeeder.deploy("USDC-TAMG-SHARE/USD");

    // update values
    await feederUsdc.updateValue(this.toEther(0.9998));
    await feederTamg.updateValue(this.toEther(0.4));
    await feederUsd.updateValue(this.toEther(1));
    await feederUsdcTamgShare.updateValue(this.toEther(1380000))


    // register them all
    await priceResolver.registerPriceFeeder(
        ethers.utils.formatBytes32String("USDC/USD"),
        feederUsdc.address,
        false,
        this.toEther(0.9998)
    )
    await priceResolver.registerPriceFeeder(
        ethers.utils.formatBytes32String("TAMG/USD"),
        feederTamg.address,
        false,
        this.toEther(0.4)
    )
    await priceResolver.registerPriceFeeder(
        ethers.utils.formatBytes32String("USD"),
        feederUsd.address,
        false,
        this.toEther(1)
    )
    await priceResolver.registerPriceFeeder(
        ethers.utils.formatBytes32String("USDC-TAMG-SHARE/USD"),
        feederUsdcTamgShare.address,
        false,
        this.toEther(1380000)
    )

    return priceResolver
}