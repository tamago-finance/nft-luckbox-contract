"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const PriceFeeder = require("./abi/PriceFeeder.json")

const HDWalletProvider = require('@truffle/hdwallet-provider')

const privateKey = ""
const kovanRpcUrl = ""
const oracles = ["0xe474820BC9D9FB599432944fFc6f3f7927dAb8D7" , "0xF43BFd791f831741b0Be0aDCe2F18b4dfdc923e8"]

// For KOVAN only
const requestPrice = async (event) => {

    console.log("Scheduler started")
    const provider = new ethers.providers.Web3Provider(new HDWalletProvider(privateKey, kovanRpcUrl));

    for ( let oracle of oracles) {
        console.log("requesting price for : ", oracle)
        const contract = new ethers.Contract(oracle, PriceFeeder.abi, provider.getSigner());
        await contract.requestPrice(0)
        console.log("requesting price for : ", oracle," - COMPLETED")
    }

    console.log("Scheduler stopped")
}

const requestPriceScheduler = new aws.cloudwatch.onSchedule(
    "requestPrice",
    "rate(1 day)",
    requestPrice,
);