const MockToken = artifacts.require("MockToken")

module.exports.setupSystem = async (accounts) => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    const quoteToken = await MockToken.new("USD Stablecoin", "USD", { from: admin })

    await quoteToken.transfer(alice, web3.utils.toWei("10000"))
    await quoteToken.transfer(bob, web3.utils.toWei("10000"))

    return {
        quoteTokenAddress: quoteToken.address
    }

}