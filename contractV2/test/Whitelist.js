const { expect } = require("chai");

let instance
let admin
let alice
let bob

describe('Whitelist contract', () => {

    before(async () => {

        [admin, alice, bob] = await ethers.getSigners();

        const Whitelist = await ethers.getContractFactory("Whitelist");

        instance = await Whitelist.deploy()
    })

    it('add and remove whitelist users ', async () => {
        // default whitelisted user
        expect(await instance.isWhitelisted(admin.address)).to.true

        expect(await instance.isWhitelisted(alice.address)).to.false
        expect(await instance.isWhitelisted(bob.address)).to.false

        // add Alice and Bob to the whitelist
        await instance.connect(admin).addAddress(alice.address) 
        await instance.connect(alice).addAddress(bob.address) 

        expect(await instance.isWhitelisted(alice.address)).to.true
        expect(await instance.isWhitelisted(bob.address)).to.true
    })

})