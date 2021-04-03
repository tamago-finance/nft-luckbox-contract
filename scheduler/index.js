"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const { ethers } = require("ethers");
const PriceFeeder = require("./abi/PriceFeeder.json")

const HDWalletProvider = require('@truffle/hdwallet-provider')

const privateKey = ""
const kovanRpcUrl = ""
const oracles = ["0x758Bd19A7627bcd9043360307658bafD557CC1D0" , "0x4eE82Da2E06c6465182d9C1FCB582F8866eB816B"]

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