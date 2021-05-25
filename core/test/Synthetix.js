const MockToken = artifacts.require('MockToken')
const SyntheticToken = artifacts.require('SyntheticToken')
const ColleteralEth = artifacts.require('CollateralEth')
const CollateralState = artifacts.require('CollateralState')
const Synthetix = artifacts.require('ISynthetix')
const Resolver = artifacts.require('IAddressResolver')

const { getContracts, getLoanId, advanceTimeAndBlock } = require("./helpers/Utils")

let sUsdToken
let sBtcToken
let collateralEth
let collateralEthState
let resolver
let synthetix

contract('Synthetix', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    beforeEach(async () => {
        const { SynthBtcAddress, SynthUsdAddress, CollateralEthAddress, CollateralStateEthAddress, ResolverAddress, SynthetixAddress } = getContracts()

        sUsdToken = await MockToken.at(SynthUsdAddress)
        sBtcToken = await MockToken.at(SynthBtcAddress)
        collateralEth = await ColleteralEth.at(CollateralEthAddress)
        collateralEthState = await CollateralState.at(CollateralStateEthAddress)
        resolver = await Resolver.at(ResolverAddress)
        synthetix = await Synthetix.at(SynthetixAddress)

    })

    it('open & close a loan', async () => {
        // const amountToDeposit = web3.utils.toWei("2") // 2 ETH
        // const amountToBorrow = web3.utils.toWei("3000") // 100 sUSD

        // const borrowCurrencyBytes = "0x73555344" // sUSD

        // const maxLoan = await collateralEth.maxLoan(web3.utils.toWei("2"), borrowCurrencyBytes)

        // assert(Number(web3.utils.fromWei(maxLoan)) > 3000, true)

        // const tx = await collateralEth.open(amountToBorrow, borrowCurrencyBytes, {
        //     from: alice,
        //     value: amountToDeposit,
        // });

        // const balance = await sUsdToken.balanceOf(alice)
        // assert(Number(web3.utils.fromWei(balance)), 3000)

        // const loanId = await getLoanId(tx)
        // const loan = await collateralEthState.getLoan(alice, `${loanId}`)
        
        // const ratio = await collateralEth.collateralRatio(loan)
 
        // const period = await collateralEth.interactionDelay()

        // await advanceTimeAndBlock(Number(period))

        // // removing some collateral
        // await collateralEth.withdraw(loanId, web3.utils.toWei("0.1"), {
        //     from: alice
        // });
        // const loanAfter = await collateralEthState.getLoan(alice, `${loanId}`)
        // const ratioAfter = await collateralEth.collateralRatio(loanAfter)

        // assert(Number(web3.utils.fromWei(ratio)) > Number(web3.utils.fromWei(ratioAfter)), true)

        // depositing more collateral
        // await advanceTimeAndBlock(Number(period))
        // await collateralEth.deposit(alice, loanId, {
        //     from: alice,
        //     value: web3.utils.toWei("0.5")
        // });
        // const newRatio = web3.utils.fromWei(await collateralEth.collateralRatio(await collateralEthState.getLoan(alice, `${loanId}`)))
        // assert(newRatio > ratio, true)

        // // closing
        // await advanceTimeAndBlock(Number(period))

        // await collateralEth.close(loanId, {
        //     from: alice
        // });

    })

    it('trade synths', async () => {
        // // borrow sUSD from lending pools
        // const amountToDeposit = web3.utils.toWei("2") // 2 ETH
        // const amountToBorrow = web3.utils.toWei("3000") // 100 sUSD
        // const borrowCurrencyBytes = "0x73555344" // sUSD

        // const tx = await collateralEth.open(amountToBorrow, borrowCurrencyBytes, {
        //     from: alice,
        //     value: amountToDeposit,
        // });

        // const currentBalance = await sUsdToken.balanceOf(alice) 

        // await sUsdToken.approve( synthetix.address , currentBalance , { from : alice } )

        // const targetTokenBytes = "0x73425443" // sBTC
        // // swaps sUSD to sBTC
        // await synthetix.exchange( borrowCurrencyBytes, currentBalance , targetTokenBytes , { from : alice })

        // const sUsdBalance = await sUsdToken.balanceOf(alice) 
        // assert( sUsdBalance, 0)

        // const sBtcBalance = await sBtcToken.balanceOf(alice)
        // assert( Number(web3.utils.fromWei(sBtcBalance)) !== 0 ,true)

        // // check the ratio
        // const loanId = await getLoanId(tx)
        // const loan = await collateralEthState.getLoan(alice, `${loanId}`)
        // const ratio = await collateralEth.collateralRatio(loan)

        // assert(Number(web3.utils.fromWei(ratio) > 1.3), true)

    })

})