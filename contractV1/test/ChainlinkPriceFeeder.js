const ChainlinkPriceFeeder = artifacts.require('ChainlinkPriceFeeder')

let chainlinkPriceFeeder

contract('Chainlink Price Feeder', accounts => {

    let isMainnet = false

    before(async () => {

        try {

            // chainlinkPriceFeeder = await ChainlinkPriceFeeder.new(
            //     "Facebook Stock",
            //     "0xCe1051646393087e706288C1B57Fd26446657A7f",
            //     8
            // )

            chainlinkPriceFeeder = await ChainlinkPriceFeeder.new(
                "Bitcoin",
                "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
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
            assert(Number(web3.utils.fromWei(value)) > 100, true)
            const timestamp = await chainlinkPriceFeeder.getTimestamp()
            assert(timestamp !== 0, true)
        }
    })

    it('retrive 30/60/90/120 days average prices ', async () => {
        if (isMainnet) {
            // 30 days
            const avg30 = await chainlinkPriceFeeder.getAveragePrice(30)
            assert( web3.utils.fromWei(avg30[0]) !== "0" , true )
            // 60 days
            const avg60 = await chainlinkPriceFeeder.getAveragePrice(60)
            assert( web3.utils.fromWei(avg60[0]) !== "0" , true )
            // 90 days
            const avg90 = await chainlinkPriceFeeder.getAveragePrice(90)
            assert( web3.utils.fromWei(avg90[0]) !== "0" , true )
            //  120 days
            const avg120 = await chainlinkPriceFeeder.getAveragePrice(120)
            assert( web3.utils.fromWei(avg120[0]) !== "0" , true )

            // should fail at 121
            try {
                const avg121 = await chainlinkPriceFeeder.getAveragePrice(121)
            } catch (e) {
                assert( (e.message).indexOf("Given day is exceeding MAX_DAY_BACKWARD") !== -1 , true )
            }

        }
    })

})