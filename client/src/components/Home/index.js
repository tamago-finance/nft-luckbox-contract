import React, { useState, useCallback } from 'react'
import { Container, Button } from "reactstrap"
import styled from "styled-components"
import TokenList from "./TokenList"

// the first vAMM based perpetual contract protocol built on #Neo.

// Why Tamago Finance?

// How to get started

// Join Our Community


const Headline = styled(
    ({ className, currentNetwork, setNetwork }) => {
        return (
            <div className={className}>
                <div>
                    <h3>The first PMM based perpetual swap protocol built for non-crypto derivatives</h3>
                    {/* <p>
                        HotpotSwap allows trade any major stock market indices up to 10x leverage via perpetual swap contracts using BUSD as a collateral on Binance Smart Chain.
                    </p> */}
                </div>
                <div className="button-row">
                    <Button onClick={() => setNetwork(0)} color={currentNetwork === 0 ? "info" : "secondary"}>
                        Development
                    </Button>
                    <Button onClick={() => setNetwork(1)} color={currentNetwork === 1 ? "info" : "secondary"}>
                        Ethereum Kovan
                    </Button>
                    <Button disabled={true} onClick={() => setNetwork(2)} color={currentNetwork === 2 ? "info" : "secondary"}>
                        Acala Testnet
                    </Button>
                </div>
            </div>
        )
    })`
    text-align: center; 
    padding-top: 30px;
    padding-bottom: 10px;

    .button-row {
        margin-top: 20px;
        margin-bottom: 20px;
        button {
            :not(:last-child) {
                margin-right: 5px;
            }
        }
    }

    .icon {
        margin-right: 5px;
    }

    div {
        margin-left: auto;
        margin-right: auto; 
        max-width: 800px;
    }
    `


const Home = () => {

    const [currentNetwork, setNetwork] = useState(0) // 0 - Dev, 1 - Kovan, 2 - Acala

    return (
        <Container>
            <Headline
                currentNetwork={currentNetwork}
                setNetwork={setNetwork}
            />
            <TokenList
                currentNetwork={currentNetwork}
            />
        </Container>
    )
}

export default Home