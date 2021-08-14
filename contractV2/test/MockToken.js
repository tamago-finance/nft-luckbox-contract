const { expect } = require("chai");
const { fromEther } = require("./Helpers")

let mockToken
let owner
let alice


describe("MockToken contract", () => {

    before(async () => {

        [owner, alice] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockToken");
        mockToken = await MockToken.deploy("Mock Token", "MOCK");

    })

    it("Deployment should assign the total supply of tokens to the owner", async function () {
        const ownerBalance = await mockToken.balanceOf(owner.address);
        expect(await mockToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Return correct name and symbol", async function () {
        const name = await mockToken.name();
        expect(name).to.equal("Mock Token");

        const symbol = await mockToken.symbol();
        expect(symbol).to.equal("MOCK");

    });

    it("Request tokens from faucet", async function () {

        await mockToken.connect(alice).faucet();

        const aliceBalance = await mockToken.balanceOf(alice.address);
        expect(fromEther(aliceBalance)).to.equal("10000.0");
    });

});