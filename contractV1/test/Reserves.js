const MockToken = artifacts.require('MockToken')
const Reserves = artifacts.require('Reserves')

const { getContracts, advanceTimeAndBlock, getLoanId, WAITING_PERIOD } = require("./helpers/Utils")


let reservesInstance
let tokenAInstance
let tokenBInstance
let sUsdToken

// contract('Reserves', accounts => {

//     const admin = accounts[0]
//     const alice = accounts[1]
//     const bob = accounts[2]

//     let isMainnet = false

//     before(async () => {

//         const { ResolverAddress } = getContracts()

//         tokenAInstance = await MockToken.new("Token A", "A")
//         tokenBInstance = await MockToken.new("Token B", "B")

//         await tokenAInstance.transfer(alice, web3.utils.toWei("10000"))
//         await tokenAInstance.transfer(bob, web3.utils.toWei("10000"))
//         await tokenBInstance.transfer(alice, web3.utils.toWei("10000"))
//         await tokenBInstance.transfer(bob, web3.utils.toWei("10000"))

//         reservesInstance = await Reserves.new(ResolverAddress)

//         await tokenAInstance.approve(reservesInstance.address, web3.utils.toWei("10000"), { from: alice })
//         await tokenBInstance.approve(reservesInstance.address, web3.utils.toWei("10000"), { from: bob })
//     })

//     it('deposit ERC-20 tokens', async () => {
//         // add try/catch block for local network
//         try {
//             await reservesInstance.deposit(tokenAInstance.address, web3.utils.toWei("100"), { from: alice })
//             await reservesInstance.deposit(tokenBInstance.address, web3.utils.toWei("200"), { from: bob })

//             const totalTokenA = await reservesInstance.reserves(tokenAInstance.address)
//             assert(web3.utils.fromWei(totalTokenA), "100")

//             const totalTokenB = await reservesInstance.reserves(tokenBInstance.address)
//             assert(web3.utils.fromWei(totalTokenB), "200")
//         } catch (e) {

//         }

//     })

//     it('withdraw ERC-20 tokens by admin', async () => {

//         try {
//             await reservesInstance.withdraw(tokenAInstance.address, web3.utils.toWei("100"), { from: alice })
//         } catch (e) {
//             assert(e.message.indexOf("caller is not the owner") !== -1, true)
//         }

//         // add try/catch block for local network
//         try {
//             await reservesInstance.withdraw(tokenAInstance.address, web3.utils.toWei("100"), { from: admin })

//             const totalTokenA = await reservesInstance.reserves(tokenAInstance.address)
//             assert(web3.utils.fromWei(totalTokenA), "0")

//             const balanceTokenA = await tokenAInstance.balanceOf(admin)
//             assert(web3.utils.fromWei(balanceTokenA), "100")
//         } catch (e) {

//         }

//     })

//     it('Look out for Synthetix contract addresses', async () => {

//         try {
//             await reservesInstance.init()
//             isMainnet = true
//         } catch (e) {
//             isMainnet = false
//         }

//         if (isMainnet) {

//             const synthetixAddress = await reservesInstance.synthetix()
//             assert(synthetixAddress.indexOf("0x") !== -1, true)
//             const collateralTokenAddress = await reservesInstance.collateralToken()
//             assert(collateralTokenAddress.indexOf("0x") !== -1, true)

//         }

//     })

//     it('Borrow sUSD against ETH from Synthetix', async () => {

//         if (isMainnet) {

//             // min. 2 ETH
//             const tx = await reservesInstance.issueSynthsUSD(
//                 {
//                     from: admin,
//                     value: web3.utils.toWei("5")
//                 }
//             )
//             await advanceTimeAndBlock(WAITING_PERIOD)
//             const loanId = await getLoanId(tx)
//             await reservesInstance.completeIssueSynthsUSD(loanId, { from: admin })

//             // Check sUSD that deposited in the contract
//             const { SynthUsdAddress } = getContracts()
//             sUsdToken = await MockToken.at(SynthUsdAddress)

//             assert(
//                 await sUsdToken.balanceOf(reservesInstance.address),
//                 await reservesInstance.reserves(SynthUsdAddress)
//             )

//             // Check the collateral ratio
//             const totalLoan = await reservesInstance.getLoanCount()
//             for (let i = 0; i < Number(totalLoan); i++) {
//                 const loanId = await reservesInstance.getLoanId(i)
//                 const ratio = await reservesInstance.getCollateralRatio(loanId)
//                 // liquidation ratio 133%
//                 assert(Number(web3.utils.fromWei(ratio)), 1.33)
//             }

//         }

//     })

//     it('Convert sUSD -> sBTC', async () => {

//         if (isMainnet) {

//             const { SynthUsdAddress } = getContracts()
//             const synthsUsdBalance = await reservesInstance.reserves(SynthUsdAddress)
//             const tradeAmount = Number(web3.utils.fromWei(synthsUsdBalance)) / 2

//             const target = "0x73425443" // sBTC
//             const targetAddress = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6"

//             await reservesInstance.convertSynthsUSD(target, targetAddress, web3.utils.toWei(`${tradeAmount}`))

//             const synthsBtcBalance = await reservesInstance.reserves(targetAddress)
//             assert(synthsBtcBalance.toString() !== "0", true)

//         }

//     })

//     it('Convert sUSD -> sETH', async () => {

//         if (isMainnet) {

//             const { SynthUsdAddress } = getContracts()
//             const synthsUsdBalance = await reservesInstance.reserves(SynthUsdAddress)

//             const target = "0x73455448" // sETH
//             const targetAddress = "0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb"

//             await reservesInstance.convertSynthsUSD(target, targetAddress, synthsUsdBalance)

//             const synthsEthBalance = await reservesInstance.reserves(targetAddress)
//             assert(synthsEthBalance.toString() !== "0", true)

//         }

//     })

// })