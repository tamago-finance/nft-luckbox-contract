const Whitelist = artifacts.require('Whitelist')

let instance

// contract('Whitelist', accounts => {

//     const admin = accounts[0]
//     const alice = accounts[1]
//     const bob = accounts[2]

//     before(async () => {
//         instance = await Whitelist.new()
//     })

//     it('add and remove whitelist users ', async () => {
//         // default whitelisted user
//         let isWhitelisted = await instance.isWhitelisted(admin)
//         assert(isWhitelisted, true) 

//         isWhitelisted = await instance.isWhitelisted(alice)
//         assert(!isWhitelisted, true) 

//         isWhitelisted = await instance.isWhitelisted(bob)
//         assert(!isWhitelisted, true) 

//         await instance.addAddress(alice, { from : admin})

//         isWhitelisted = await instance.isWhitelisted(alice)
//         assert(isWhitelisted, true) 

//         await instance.addAddress(bob, { from : alice})

//         isWhitelisted = await instance.isWhitelisted(bob)
//         assert(isWhitelisted, true) 
//     })

// })