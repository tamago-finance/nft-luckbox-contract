![slide](logo.png)

Tamago Finance is a PMM-based perpetual swap protocol made for all asset classes from common stocks, financial indicators, to on-chain states built on Acala/Polkadot (EVM-compatible) and designed with a focus on usability and user experience.

**PMM stands for Proactive Market Making Algorithm which is introduced by DODO (https://dodoex.io/)** 

## Current Features

* Non-orderbook perpetual swap protocol
* Open a short or long position with up to 4x leverage on any asset class
* Proactive price discovery mechanism
* Support for APPL and TSLA stock on Kovan
* Support for DOT and renBTC tokens on Acala Mandala TC6
* Liquidation of unsafe positions


## How it works

Tamago Finance combines two mature DeFi concepts - Synthetic asset issuance protocol and DEXes provides a breakthrough end-to-end trading experience and offers many derivative products that can be listed in the system.

The magic behind our project is DODO’s Proactive Market Making model that is integrated into our price discovery mechanism unlike any other AMM-based non-orderbook derivatives DEX on the market. Other DEXes require intervention from the project’s team when slippage is too high. The PMM model Tamago Finance has is capable of proactively adjusting mid prices to achieve higher capital efficiency from external sources. 

![slide](illustration-1.png)

**There are 2 types of people that will be participating in the protocol:** 

### A. Liquidity Provider

Once liquidity providers deposit money into the vault, synthetic tokens will be minted and put into circulation. The interest given to liquidity providers will be similar to other lending protocols. 

### B. Trader

Traders open a long position by paying ¼ and will get 4x money on margin accounts to buy synthetic tokens from PMM. Collateral tokens will be acquired instead when opening a short position. It will be locked up in the vault under the trader’s position.

If synthetic tokens decreases in value by 60%, the position will be liquidated by anyone with the 10% penalty. 

### Price streams

Asset prices are observed depending on the network. 

Asset Symbol | Network  | Interval | Source 
--- | --- | --- | --- 
APPL | Kovan | Daily | Chainlink's Tiingo EOD Stock Price Oracle
TSLA | Kovan | Daily | Chainlink's Tiingo EOD Stock Price Oracle
renBTC | Acala TC6 | 15 minutes | Acala's Generic Oracle
DOT | Acala TC6 | 15 minutes | Acala's Generic Oracle

## Install

The project comprises 4 components to deploy on both Kovan and Acala. At the beginning, we can install all dependencies for all of them in one go by

```
yarn
```

### Solidity contracts

To deploy on most EVM-compatible blockchains, you can use this Truffle-based project. For development purposes you can deploy all contracts into your local ganache node. 

```
cd core
truffle compile
truffle migration
```

### Solidity contracts (Acala)

Acala doesn’t seem to support Truffle yet, so we are porting all contracts in /core into Waffle-based

```
cd acala
yarn waffle
```

Later, you would need to use **Acala EVM playboard** (https://evm.acala.network) to deploy all compiled files and manually config the perpetual contracts as in the migration script from /core folder. 

### Dapp

This is made by react-create-app which is compatible with most modern browsers. To run it locally, just run

```
cd client
yarn start
```

### Scheduler

The scheduler runs on a daily bais to trigger the request to the Oracle and ensure the index price is up to date. 

We're using **Pulumi** (https://www.pulumi.com/) as an automation tool to setup infrastructure on the AWS cloud. 

Ensure that you have Pulumi CLI in your machine and then run

```
cd backend
pulumi up
```

On-chain scheduler feature has been used on Acala side which is a managed schedule service that greatly reduces maintenance costs on the project team side. 

## License

* Open-source [MIT](LICENSE)
