const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')

let chainlinkPriceFeeder

contract('Chainlink Price Feeder', accounts => {

    let isMainnet = false

    before(async () => {

        try {

            chainlinkPriceFeeder = await ChainlinkPriceFeeder.new(
                "Facebook Stock",
                "0xCe1051646393087e706288C1B57Fd26446657A7f",
                8
            )

            if (await chainlinkPriceFeeder.getValue() !== 0) {
                isMainnet = true
            }

        } catch (e) {
            // console.log(e)
        }
    })

    it('retrieve current price and timestamp', async () => {
        if (isMainnet) {
            const value = await chainlinkPriceFeeder.getValue()
            assert( Number(web3.utils.fromWei(value)) > 100 , true )
            const timestamp = await chainlinkPriceFeeder.getTimestamp()
            assert( timestamp !== 0 , true )
        }
    })

})