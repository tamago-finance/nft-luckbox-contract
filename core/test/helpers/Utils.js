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


module.exports.calculateLongPnl = async (pmm, position) => {
    return (Number(web3.utils.fromWei(await pmm.querySellBaseToken(position.positionSize))))-(Number(web3.utils.fromWei(position.positionSize)) * Number(web3.utils.fromWei(position.entryValue)))
}

module.exports.calculateShortPnl = async (pmm, position) => {
    // const size = Number(web3.utils.fromWei(position.positionSize)) * ((Number(position.leverage))+1)
    return (Number(web3.utils.fromWei(position.leveragedAmount))) - ((Number(web3.utils.fromWei(await pmm.queryBuyBaseToken(position.positionSize)))) )
}