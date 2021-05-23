const abiDecoder = require('abi-decoder')

const loanCreatedEvent = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "collateral",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "currency",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "issuanceFee",
                "type": "uint256"
            }
        ],
        "name": "LoanCreated",
        "type": "event",
        "signature": "0x604952b18be5fed608cbdd28101dc57bd667055c9678ec6d44fb1d8e4c7c172a"
    }
]

abiDecoder.addABI(loanCreatedEvent)

module.exports.getContracts = () => {
    return {
        "SynthUsdAddress": "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51",
        "SynthBtcAddress": "0xDB91E4B3b6E19bF22E810C43273eae48C9037e74",
        "ResolverAddress": "0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83",
        "CollateralManagerStateAddress": "0x573E5105c4B92416D1544A188F1bf77d442Bb52d",
        "CollateralManagerAddress": "0x067e398605E84F2D0aEEC1806e62768C5110DCc6",
        "CollateralErc20Address": "0xaa03aB31b55DceEeF845C8d17890CC61cD98eD04",
        "CollateralEthAddress": "0x5c8344bcdC38F1aB5EB5C1d4a35DdEeA522B5DfA",
        "CollateralStateEthAddress": "0xbe5B5a7c198bC156474ed5c33CBf2F3F604F8fF8",
        "DebtCacheAddress": "0x12c815b0c404D66Dd0491f4EC62839904cec25e7",
        "SynthetixAddress": "0x97767D7D04Fd0dB0A1a2478DCd4BA85290556B48"
    }
}

module.exports.getLoanId = async (tx) => {

    const receipt = await web3.eth.getTransactionReceipt(tx.tx)
    const decodedLogs = abiDecoder.decodeLogs(receipt.logs);

    if (decodedLogs[0]) {
        const { value } = decodedLogs[0].events.find(item => item.name === "id")
        return Number(value)
    } else {
        return 0
    }

}

module.exports.WAITING_PERIOD = 600

const advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

const advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;

            return resolve(newBlockHash)
        });
    });
}


module.exports.advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock('latest'));
}

module.exports.setupReserves = async (Contract) => {

    const { ResolverAddress, SynthUsdAddress } = this.getContracts()

    reservesInstance = await Contract.new(ResolverAddress)
    await reservesInstance.init()

    // Borrow sUSD with ETH
    // min. 2 ETH
    const tx = await reservesInstance.issueSynthsUSD(
        { 
            value: web3.utils.toWei("10")
        }
    )
    await this.advanceTimeAndBlock(this.WAITING_PERIOD)
    const loanId = await this.getLoanId(tx)

    await reservesInstance.completeIssueSynthsUSD(loanId)
    
    // Convert sUSD -> sETH
    const synthsUsdBalance = await reservesInstance.reserves(SynthUsdAddress)
    const tradeAmount = Number(web3.utils.fromWei(synthsUsdBalance)) / 2

    const target = "0x73455448" // sETH
    const targetAddress = "0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb"

    await reservesInstance.convertSynthsUSD(target, targetAddress, web3.utils.toWei(`${tradeAmount}`))

    await this.advanceTimeAndBlock(this.WAITING_PERIOD)

    return reservesInstance
}