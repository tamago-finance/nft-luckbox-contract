const Pmm = artifacts.require('Pmm');
const MockToken = artifacts.require('MockToken')
const PriceFeeder = artifacts.require('PriceFeeder')
const TokenFactory = artifacts.require('TokenFactory')
const Perpetual = artifacts.require('Perpetual')
const SyntheticToken = artifacts.require('SyntheticToken')


const { getContracts, advanceTimeAndBlock, getLoanId } = require("./helpers/Utils")

const WAITING_PERIOD = 600

let priceFeed
let colleteralToken
let syntheticToken
let pmm
let perpetual
let sUsdToken
let sBtcToken

contract('Perpetual', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    // before(async () => {
    //     const { SynthUsdAddress, SynthBtcAddress, ResolverAddress } = getContracts()
    //     const tokenFactory = await TokenFactory.new()
    //     priceFeed = await PriceFeeder.new("BTC/USD")

    //     await priceFeed.updateValue(web3.utils.toWei("54000"))

    //     perpetual = await Perpetual.new(
    //         tokenFactory.address,
    //         priceFeed.address,
    //         ResolverAddress,
    //         SynthUsdAddress,
    //         "0x73555344", // sUsd
    //         SynthBtcAddress,
    //         "0x73425443" // sBTC
    //     )

    //     sUsdToken = await MockToken.at(SynthUsdAddress)
    //     sBtcToken = await MockToken.at(SynthBtcAddress)

    //     pmm = await Pmm.new(
    //         tokenFactory.address,
    //         perpetual.address,
    //         sBtcToken.address,
    //         sUsdToken.address,
    //         priceFeed.address,
    //         web3.utils.toWei("0.99") // K 
    //     )

    //     await sUsdToken.approve(perpetual.address, web3.utils.toWei("1000000"))
    //     await perpetual.setup(pmm.address, {
    //         from: admin
    //     })

    // })

    // it('add liquidity', async () => {

    //     const tx = await perpetual.depositLiquidity(
    //         web3.utils.toWei("0.5"),
    //         {
    //             from : admin,
    //             value : web3.utils.toWei("5")
    //         }
    //     )
    //     await advanceTimeAndBlock(WAITING_PERIOD)
    //     const loanId = await getLoanId(tx)
    //     await perpetual.completeDepositLiquidity( loanId , { from : admin })
        
        

    //     assert(true, true)

    // })

    // it('open a long position', async () => {

    //     const minAmount = await perpetual.minCollateralAmount()
    //     assert(Number(web3.utils.fromWei(minAmount)) , 2)

    //     const tx = await perpetual.openLongPosition(web3.utils.toWei("0.001"), {
    //         from: bob,
    //         value: minAmount,
    //     });

    //     const loanId = await getLoanId(tx)
    //     const collateralRatio = await perpetual.getCollateralRatio(loanId)
    //     assert(Number(web3.utils.fromWei(collateralRatio)) > 1.4, true)

    // })


})