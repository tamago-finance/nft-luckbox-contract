const TiingoConsumer = artifacts.require("TiingoConsumer")
const OpenWeatherConsumer   = artifacts.require("OpenWeatherConsumer")


module.exports = async (deployer, network, accounts) => {

    if (network === "development" || network === "kovan") {

        // Setup a oracle for testing
        // await deployer.deploy(
        //     TiingoConsumer,
        //     "TSLA",
        //     {
        //         from: accounts[0]
        //     })

    }

}