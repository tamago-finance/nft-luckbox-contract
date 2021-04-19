import React, { useState, useCallback, useContext } from "react" 
import { useHistory } from "react-router-dom"
import {
    Container,
    Button,
    Alert,
    Row,
    Col,
    InputGroup,
    InputGroupAddon,
    InputGroupButtonDropdown,
    Input,
    DropdownToggle,
    DropdownMenu,
    DropdownItem
} from "reactstrap"
import styled from "styled-components"
import MailchimpSubscribe from "react-mailchimp-subscribe"
import TokenList from "./TokenList"
import { NetworkContext } from "../../hooks/useNetwork"
import IllustrationPNG from "../../assets/img/illustration-1.png"
import IllustrationPNG2 from "../../assets/img/illustration-2.png"
import SocialIcon from "../common/SocialIcon"

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

const MAILCHIMP_URL = "https://elliptix.us2.list-manage.com/subscribe/post?u=99c7dd209da5d13372fa9eea4&amp;id=ff5ba55ce5"


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


const Headline = styled(
    ({ className, currentNetwork, setNetwork }) => {
        return (
            <div className={className}>
                <div>
                    <h3>The first PMM based perpetual swap protocol built for non-crypto derivatives</h3>
                </div>
                <div className="button-row">
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
          Tamago Finance is a derivatives DEX where any asset classes is
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
  margin-top: 60px;
  margin-bottom: 10px;
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


const Subscribe = styled(
    ({ className }) => {

        const [email, setEmail] = useState()

        const handleChange = (e) => {
            setEmail(e.target.value)
        }

        return (
            <div className={className}>
                <div className="box">
                    <div className="content">
                        <h2>
                            Let's keep in touch
                        </h2>
                        <p>
                            Subscribe to get the latest blog posts, news and platform annoucements straight to your inbox.
                        </p>
                        <MailchimpSubscribe
                            url={MAILCHIMP_URL}
                            render={({ subscribe, status, message }) => {

                                const submit = () => {
                                    if (!email || email === "") {
                                        return
                                    }
                                    subscribe({
                                        EMAIL: email
                                    })
                                }

                                return (
                                    <Row style={{ maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
                                        {/* <Col span={16}>
                                            <Form.Item name="email">
                                                <Input placeholder="Enter email for newsletter" value={email} onChange={handleChange} />
                                                <p className="error">
                                                   
                                                    {status === "error" && (
                                                        <div
                                                            style={{ color: "red" }}
                                                            dangerouslySetInnerHTML={{ __html: message }}
                                                        />
                                                    )}
                                                    {status === "success" && (
                                                        <div
                                                            style={{ color: "green" }}
                                                            dangerouslySetInnerHTML={{ __html: message }}
                                                        />
                                                    )}
                                                </p>
                                            </Form.Item>
                                        </Col>
                                        <Col span={8} style={{ display: "flex" }}>
                                            <div style={{ marginLeft: "auto", marginRight: "auto", marginTop: 4, paddingLeft: 4 }}>
                                                <Button loading={status === "sending"} disabled={(email && email.indexOf("@") == -1) || status === "sending" || status === "success"} size="large" type="primary" onClick={submit} >
                                                    {status === "success"
                                                        ?
                                                        <>Subscribed</>
                                                        :
                                                        <>Subscribe</>
                                                    }
                                                </Button>
                                            </div>
                                        </Col> */}
                                        <InputGroup>

                                            <Input value={email} onChange={handleChange} placeholder="Enter your email address " />
                                            <InputGroupAddon addonType="append">
                                                <Button disabled={(email && email.indexOf("@") == -1) || status === "sending" || status === "success"} color="warning" onClick={submit}>
                                                    {status === "success"
                                                        ?
                                                        <>OK</>
                                                        :
                                                        <>Signup</>
                                                    }
                                                </Button>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        <p className="error">
                                            {status === "error" && (
                                                <div
                                                    style={{ color: "red" }}
                                                    dangerouslySetInnerHTML={{ __html: message }}
                                                />
                                            )}
                                            {status === "success" && (
                                                <div
                                                    style={{ color: "green" }}
                                                    dangerouslySetInnerHTML={{ __html: message }}
                                                />
                                            )}
                                        </p>
                                    </Row>
                                )
                            }} />

                        <div className="icons">
                            <SocialIcon name={"github"} url={"https://github.com/tamago-finance/tamago-finance"} />
                            <SocialIcon name={"twitter"} url={"https://twitter.com/tamagofinance"}  />
                            <SocialIcon name={"medium"} url={"https://medium.com/tamago-finance"}  />
                        </div>
                    </div>



                </div>
            </div>
        )
    })`
    margin-top: 20px;
    margin-bottom: 40px;
    text-align: center;

    .box {
        display: flex;
        background: rgb(255,255,255);
        background: linear-gradient(0deg, #bdc3c7 0%, #2c3e50 100%);
        min-height: 400px;
        border-radius: 12px;
        max-width: 700px;
        margin-left: auto;
        margin-right: auto;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .content {
        h2 {
            letter-spacing: -2px;
            color: white;
            @media screen and (max-width: 992px) {
                font-size: 24px;    
            }

        }
        p {
            color: white;
            opacity: 0.8;
        }
        .error {
            margin-top: 10px;
            font-size: 14px;
            letter-spacing: -1px;
        }
        .icons {
            margin-top: 20px;
            
            img {
                margin-left: 20px;
                margin-right: 20px; 
            }
        }
    }




    `


const Home = () => {
  const { currentNetwork, setNetwork } = useContext(NetworkContext)

  return (
    <Container>
            <Headline
                currentNetwork={currentNetwork}
                setNetwork={setNetwork}
            />
            <Alert style={{ marginBottom: 20, textAlign: "center" }} color="warning">
                Please note that the project is under heavy development and available only on Testnet
            </Alert>
            <TokenList
                currentNetwork={currentNetwork}
            />
            <About />
            <Subscribe />
            <Footer />
        </Container>
  )
}

export default Home
