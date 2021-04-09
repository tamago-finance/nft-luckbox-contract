import React, { useState, useCallback, useContext } from "react"
import { Container, Button, Alert, Row, Col } from "reactstrap"
import { useHistory } from "react-router-dom"
import { web3FromAddress } from "@polkadot/extension-dapp"
import styled from "styled-components"
import TokenList from "./TokenList"
import { NetworkContext } from "../../hooks/useNetwork"
import { Web3AcalaContext } from "../../hooks/Acala/useWeb3Acala"
import { useToasts } from "../../hooks/useToasts"
import { processingToast } from "../../utils"
import IllustrationPNG from "../../assets/img/illustration-1.png"
import IllustrationPNG2 from "../../assets/img/illustration-2.png"

// Join Our Community

// Roadmap

const Illustration = styled.img.attrs((props) => ({
  src: IllustrationPNG,
}))`
  width: 80%;
`

const Illustration2 = styled.img.attrs((props) => ({
  src: IllustrationPNG2,
}))`
  width: 100%;
`

const Headline = styled(({ className, currentNetwork, setNetwork }) => {
  const history = useHistory()
  const goTo = (route = "/") => {
    history.push(`${route}`)
  }
  return (
    <div className={className}>
      <div>
        <h3>
          The first PMM based perpetual swap protocol built for non-crypto
          derivatives
        </h3>
      </div>
      <div className='button-row'>
        {/* <Button onClick={() => setNetwork(0)} color={currentNetwork === 0 ? "info" : "secondary"}>
                        Development
                    </Button> */}
        <Button
          onClick={() => {
            setNetwork(1)
            goTo("/")
          }}
          color={currentNetwork === 1 ? "info" : "secondary"}
        >
          Ethereum Kovan
        </Button>
        <Button
          //   disabled={true}
          onClick={() => {
            setNetwork(2)
            goTo("/acala")
          }}
          color={currentNetwork === 2 ? "info" : "secondary"}
        >
          Acala Testnet
        </Button>
      </div>
    </div>
  )
})`
  text-align: center;
  padding-top: 30px;

  .button-row {
    margin-top: 20px;
    margin-bottom: 20px;
    button {
      :not(:last-child) {
        margin-right: 5px;
      }
    }
  }

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
`

const About = styled(({ className }) => (
  <div className={className}>
    <Row>
      <Col lg='6'>
        <Button style={{ cursor: "default" }} color='warning' />
        <h2>Trade all asset classes up to 4x leverage</h2>
        <p>
          Tamago Finance is a derivatives DEX where any asset classes are
          possible to be listed through our unique price discovery mechanism
        </p>
      </Col>
      <Col lg='6'>
        <div style={{ textAlign: "center" }}>
          <Illustration />
        </div>
      </Col>
      <Col lg='6'>
        <div style={{ textAlign: "center" }}>
          <Illustration2 />
        </div>
      </Col>
      <Col lg='6'>
        <Button style={{ cursor: "default" }} color='warning' />
        <h2>Combine the best features of Synthetix and DODO</h2>
        <p>
          We're applying DODO’s PMM model that helps the synthetic derivatives
          asset capable of proactively adjusting prices from Oracle or on-chain
          states
        </p>
      </Col>
    </Row>
  </div>
))`
  margin-top: 40px;
  margin-bottom: 40px;

  h2 {
    font-weight: 600;
    font-size: 24px;
    letter-spacing: -1px;
    margin-bottom: 20px;
    margin-top: 10px;
  }
`

const Footer = styled(({ className }) => (
  <div className={className}>
    <div>Buidl during Chainlink Hackathon 2021</div>
    <div>© Tamago Finance, 2021. All rights reserved.</div>
  </div>
))`
  margin-top: 20px;
  display: flex;
  flex-direction: row;
  font-size: 12px;
  div {
    flex: 50%;
    :last-child {
      text-align: right;
    }
  }
`

const Home = () => {
  const { currentNetwork, setNetwork } = useContext(NetworkContext)
  const { blindEthAddress, acalaApi, acalaAccount, increaseTick } = useContext(
    Web3AcalaContext
  )
  const { add, update } = useToasts()

  //   const [currentNetwork, setNetwork] = useState(1) // 0 - Dev, 1 - Kovan, 2 - Acala

  const claimEvmAddress = async () => {
    const injector = await web3FromAddress(acalaAccount.address)
    acalaApi.setSigner(injector.signer)
    await acalaApi.tx.evmAccounts
      .claimDefaultAccount()
      .signAndSend(acalaAccount.address, async (status) => {
        const { status: newStatus } = status.toHuman()
        let id
        if (Object.keys(newStatus)[0] === "Finalized") {
          update({
            id,
            ...processingToast(
              "Complete",
              "Your transaction is completed",
              false,
              "",
              0
            ),
          })
          increaseTick()
        } else if (Object.keys(newStatus)[0] === "InBlock") {
          id = add(
            processingToast(
              "Processing",
              "Claims your Acala EVM address",
              true,
              "",
              0
            )
          )
        }
      })
  }

  return (
    <Container>
      <Headline currentNetwork={currentNetwork} setNetwork={setNetwork} />
      <Alert style={{ marginBottom: 20, textAlign: "center" }} color='warning'>
        Please note that the project is under heavy development and available
        only on Testnet
      </Alert>
      {!blindEthAddress ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Button color='danger' onClick={claimEvmAddress}>
            Please Claim your Acala EVM address
          </Button>
        </div>
      ) : null}
      <TokenList currentNetwork={currentNetwork} />
      <About />
      <Footer />
    </Container>
  )
}

export default Home
