import { useContext, useCallback, useState, useEffect } from "react"
import styled from "styled-components";
import {
    Alert,
    Table,
    Jumbotron,
    Nav,
    Form,
    InputGroupAddon,
    InputGroupText,
    FormGroup,
    Label,
    NavItem,
    TabContent,
    TabPane,
    TabItem,
    NavLink,
    Row,
    Col,
    Button,
    ButtonGroup,
    InputGroup,
    Input,
    Modal,
    Spinner,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "reactstrap"
import classnames from 'classnames';
import { useWeb3React } from '@web3-react/core'
import { DollarSign, Plus } from "react-feather"
import { ContractContext } from "../../hooks/useContract"
import { useToasts } from "../../hooks/useToasts"
import { processingToast } from "../../utils"
import useInterval from "../../hooks/useInterval"


const Container = styled.div`
    padding: 6px 12px;
    border: 1px solid #ddd; 
    background: white;

    opacity: ${props => props.locked ? "0.6" : "1.0"};

    p {
        font-size: 12px;
    }
    th, td {
        padding: 0px;
        padding-top: 5px;
        padding-bottom: 5px;
    }
    a {
        color: inherit;
        cursor: pointer;
    }

`

const Error = ({ errorMessage }) => {
    return (
        <div style={{ textAlign: "center", fontSize: 12, height: 30, fontWeight: 600, color: "red" }}>
            {errorMessage}
        </div>
    )
}


const TradePanel = ({ perpetual, collateralToken, symbol, locked }) => {

    const { chainId, account } = useWeb3React()
    const { increaseTick } = useContext(ContractContext)
    const { add, update } = useToasts()
    const [side, setSide] = useState(0) // 0 - long, 1 - short
    const [amount, setAmount] = useState(1)
    const [buyPrice, setBuyPrice] = useState(0)
    const [sellPrice, setSellPrice] = useState(0)
    const [leverage, setLeverage] = useState(1)
    const [approved, setApproved] = useState(false)

    const [errorMessage, setErrorMessage] = useState()

    useEffect(() => {
        if (perpetual && collateralToken && perpetual.perpetualAddress) {

            collateralToken.allowance(perpetual.perpetualAddress).then(
                result => {
                    if (Number(result) > 0) {
                        setApproved(true)
                    }
                }
            )

        }
    }, [collateralToken, perpetual, account])

    useInterval(() => {

        if (perpetual && amount > 0) {

            (async () => {

                let errorCount = 0
                let buyPrice = 1
                let sellPrice = 1

                try {
                    buyPrice = await perpetual.getBuyPrice(amount)
                    setBuyPrice(Number(buyPrice))
                } catch (e) {
                    errorCount += 1
                    setErrorMessage("Price Calculation Error")
                }

                try {
                    sellPrice = await perpetual.getSellPrice(amount)
                    setSellPrice(Number(sellPrice))
                } catch (e) {
                    errorCount += 1
                    setErrorMessage("Price Calculation Error")
                }

                if (errorCount === 0) {
                    setErrorMessage()
                }

            })()

        }

    }, 3000)

    const onFaucet = useCallback(async () => {
        const tx = await collateralToken.faucet()
        const id = add(processingToast("Requesting tokens", "Your transaction is being processed", true, tx.hash, chainId))
        await tx.wait()
        update({
            id,
            ...processingToast("Received", "Your transaction is completed", false, tx.hash, chainId)
        })

        increaseTick()
    }, [collateralToken, chainId])

    const onApprove = useCallback(async () => {

        const tx = await collateralToken.approve(perpetual.perpetualAddress)
        const id = add(processingToast("Approving", "Your transaction is being processed", true, tx.hash, chainId))
        await tx.wait()
        setApproved(true)
        update({
            id,
            ...processingToast("Approved", "Your transaction is completed", false, tx.hash, chainId)
        })
    }, [collateralToken, perpetual, chainId])

    const handleChange = (e) => {
        setAmount(Number(e.target.value))
    }

    const onBuy = useCallback(async () => {

        const tx = await perpetual.buy(amount, (Number(leverage) * Number(amount) * Number(buyPrice) * 1.1), leverage - 1)
        const id = add(processingToast("Buying", "Your transaction is being processed", true, tx.hash, chainId))
        await tx.wait()
        setApproved(true)
        update({
            id,
            ...processingToast("Approved", "Your transaction is completed", false, tx.hash, chainId)
        })

        increaseTick()
        
    }, [perpetual, amount, buyPrice, leverage])

    const onSell = useCallback(async () => {

        const tx = await perpetual.sell(amount, (Number(leverage) * Number(amount) * Number(sellPrice) * 1.1), leverage - 1)
        const id = add(processingToast("Selling", "Your transaction is being processed", true, tx.hash, chainId))
        await tx.wait()
        setApproved(true)
        update({
            id,
            ...processingToast("Approved", "Your transaction is completed", false, tx.hash, chainId)
        })

        increaseTick()

    }, [perpetual, amount, sellPrice, leverage])

    return (
        <Container locked={locked}>
            {/* <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam</p> */}
            {/* <Alert color="info">Lorem ipsum dolor sit amet</Alert> */}
            <Nav tabs>
                <NavItem>
                    <NavLink
                        className={classnames({ active: side === 0 })}
                        onClick={() => setSide(0)}
                    >
                        Long
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink
                        className={classnames({ active: side === 1 })}
                        onClick={() => setSide(1)}
                    >
                        Short
                    </NavLink>
                </NavItem>
            </Nav>
            <TabContent style={{ paddingTop: 20 }} activeTab={`${side}`}>
                <TabPane tabId="0">
                    {/* Long */}
                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="buyPrice">Price</Label>
                                <InputGroup>
                                    <Input value={buyPrice.toLocaleString()} type="text" disabled name="buyPrice" id="buyPrice" />
                                    <InputGroupAddon addonType="append">
                                        {collateralToken?.symbol}
                                    </InputGroupAddon>
                                </InputGroup>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="buyAmount">Amount</Label>
                                <InputGroup>
                                    <Input disabled={locked} step="0.1" value={amount} onChange={handleChange} type="number" name="buyAmount" id="buyAmount" />
                                    <InputGroupAddon addonType="append">
                                        {symbol}
                                    </InputGroupAddon>
                                </InputGroup>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="leverage">Leverage</Label>
                                <div>
                                    <ButtonGroup>
                                        <Button disabled={locked} onClick={() => setLeverage(1)} color={leverage === 1 ? "primary" : "secondary"}>1x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(2)} color={leverage === 2 ? "primary" : "secondary"}>2x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(3)} color={leverage === 3 ? "primary" : "secondary"}>3x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(4)} color={leverage === 4 ? "primary" : "secondary"}>4x</Button>
                                    </ButtonGroup>
                                </div>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Summary
                        locked={locked}
                        collateralToken={collateralToken}
                        onFaucet={onFaucet}
                        amount={amount}
                        leverage={leverage}
                        price={buyPrice}
                        symbol={symbol}
                        availableMargin={Number(perpetual?.liquidity?.availableQuote)}
                    />
                    <Error errorMessage={errorMessage} />
                    <Button disabled={approved || locked} onClick={onApprove} color="info" block>Approve</Button>
                    <Button onClick={onBuy} disabled={Number(collateralToken.balance) === 0 || !approved || locked} style={{ marginBottom: 20 }} color="primary" block>Long</Button>
                </TabPane>
                <TabPane tabId="1">
                    {/* Short */}
                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="shortPrice">Price</Label>
                                <InputGroup>
                                    <Input value={sellPrice.toLocaleString()} type="text" disabled name="shortPrice" id="shortPrice" />
                                    <InputGroupAddon addonType="append">
                                        {collateralToken?.symbol}
                                    </InputGroupAddon>
                                </InputGroup>
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="shortAmount">Amount</Label>
                                <InputGroup>
                                    <Input disabled={locked} step="0.0001" value={amount} onChange={handleChange} type="number" name="shortAmount" id="shortAmount" />
                                    <InputGroupAddon addonType="append">
                                        {symbol}
                                    </InputGroupAddon>
                                </InputGroup>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs="12">
                            <FormGroup>
                                <Label for="leverage">Leverage</Label>
                                <div>
                                    <ButtonGroup>
                                        <Button disabled={locked} onClick={() => setLeverage(1)} color={leverage === 1 ? "primary" : "secondary"}>1x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(2)} color={leverage === 2 ? "primary" : "secondary"}>2x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(3)} color={leverage === 3 ? "primary" : "secondary"}>3x</Button>
                                        <Button disabled={locked} onClick={() => setLeverage(4)} color={leverage === 4 ? "primary" : "secondary"}>4x</Button>
                                    </ButtonGroup>
                                </div>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Summary
                        locked={locked}
                        collateralToken={collateralToken}
                        onFaucet={onFaucet}
                        amount={amount}
                        leverage={leverage}
                        symbol={symbol}
                        price={sellPrice}
                        availableMargin={Number(perpetual?.liquidity?.availableBase) * Number(sellPrice)}
                    />
                    <Error errorMessage={errorMessage} />
                    <Button disabled={approved || locked} onClick={onApprove} color="info" block>Approve</Button>
                    <Button onClick={onSell} disabled={Number(collateralToken.balance) === 0 || !approved || locked} style={{ marginBottom: 20 }} color="primary" block>Short</Button>
                </TabPane>
            </TabContent>
        </Container>
    )
}


const Summary = ({ locked, collateralToken, onFaucet, amount, leverage, price, availableMargin, symbol }) => {
 
    return (
        <div>
            <Table>
                <tbody>
                    <tr>
                        <th scope="row">
                            <div style={{ marginTop: 3 }}>Current Balance</div>
                        </th>
                        <td style={{ display: "flex", flexDirection: "row" }}>
                            <div style={{ marginTop: 3 }}>{collateralToken.balance}{` `}{collateralToken.symbol}</div>
                            <Button disabled={locked} onClick={onFaucet} style={{ marginLeft: 5 }} color="info" size="sm">
                                <Plus size={16} />
                            </Button>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <div>Available Margin</div>
                        </th>
                        <td>
                            {availableMargin.toLocaleString() }{` `}{collateralToken.symbol}
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <div>Leveraged Amount</div>
                        </th>
                        <td>
                            {(amount  * leverage).toLocaleString()}{` `}{symbol}
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <div>Liquidation Ratio</div>
                        </th>
                        <td>
                            0.4
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <div>Panelty Fee</div>
                        </th>
                        <td>
                            10%
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <div>Collateral Need</div>
                        </th>
                        <td>
                            {(price).toLocaleString()}{` `}{collateralToken.symbol}
                        </td>
                    </tr>
                </tbody>
            </Table>
        </div>
    )
}

export default TradePanel