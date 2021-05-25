const Vault = artifacts.require('Vault')
const MockToken = artifacts.require('MockToken')

const { getContracts, advanceTimeAndBlock, getLoanId } = require("./helpers/Utils")

const WAITING_PERIOD = 600

let vault
let sUsdToken

contract('Vault', accounts => {

    const admin = accounts[0]
    const alice = accounts[1]
    const bob = accounts[2]

    // before(async () => {
    //     const { SynthUsdAddress, SynthBtcAddress, ResolverAddress } = getContracts()

    //     vault = await Vault.new(
    //         ResolverAddress,
    //         SynthUsdAddress,
    //         "0x73555344" // sUSD
    //     )

    //     sUsdToken = await MockToken.at(SynthUsdAddress)
    //     await sUsdToken.approve(vault.address, web3.utils.toWei("1000000"))


    // })

    // it('add liquidity', async () => {

    //     const tx = await vault.depositLiquidity(
    //         {
    //             from: admin,
    //             value: web3.utils.toWei("5")
    //         }
    //     )
    //     await advanceTimeAndBlock(WAITING_PERIOD)
    //     const loanId = await getLoanId(tx)
    //     await vault.completeDepositLiquidity(loanId, { from: admin })

    //     assert(true, true)

    // })

    // it('remove liquidity', async () => {

    //     assert(true, true)

    // })

    // it('assign new admin', async () => {

    //     try {
    //         await vault.addAdmin(bob, { from: alice })
    //     } catch (e) {
    //         assert(e.message.indexOf("caller is not the owner") !== -1, true)
    //     }

    //     const before = await vault.isWhitelisted(alice)
    //     assert(!before, true)

    //     await vault.addAdmin(alice, { from: admin })

    //     const after = await vault.isWhitelisted(alice)
    //     assert(after, true)
    // })


})