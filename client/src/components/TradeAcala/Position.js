import React, { useState, useCallback, useContext } from 'react'
import styled from "styled-components"
import { Alert, Button, Table } from "reactstrap"
import { useWeb3React } from '@web3-react/core'
import { ContractContext } from "../../hooks/useContract"
import useInterval from "../../hooks/useInterval"
import { useToasts } from "../../hooks/useToasts"
import { processingToast } from "../../utils"

const Wrapper = styled.div`
    border: 1px solid black;
    min-height: 200px;
    background: white;
    margin-top: 20px;
`

const Position = ({ currentToken, setLocked }) => {

    const { chainId } = useWeb3React()
    const { collateralToken, perpetuals, increaseTick } = useContext(ContractContext)

    const perpetual = perpetuals[currentToken?.symbol]
    const [position, setPosition] = useState()

    const { add, update } = useToasts()

    useInterval(() => {

        if (perpetual) {

            (async () => {
                const position = await perpetual.getPosition()

                setLocked(position.locked)

                if (position.locked) {
                    setPosition(position)
                } else {
                    setPosition()
                }
            })()
        }
    }, 3000)


    const onClosePosition = useCallback(async () => {

        const tx = await perpetual.closePosition()
        const id = add(processingToast("Closing", "Your transaction is being processed", true, tx.hash, chainId))
        await tx.wait()
        update({
            id,
            ...processingToast("Closed", "Your transaction is completed", false, tx.hash, chainId)
        })
        increaseTick()

    }, [perpetual, chainId])

    return (
        <Wrapper>
            { !position
                ?
                <div style={{ textAlign: "center", marginTop: 80 }}>
                    You have no position
                </div>
                :
                <div style={{ fontSize: 14 }}>
                    <Table>
                        <thead>
                            <tr>
                                <th>Side</th>
                                <th>Position Size</th>
                                <th>Total Collateral</th>
                                <th>Entry Price</th>
                                <th>Profit</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th scope="row">
                                    {position?.side}
                                </th>
                                <td>
                                    {position?.positionSize}{` `}{currentToken?.symbol}
                                </td>
                                <td>
                                    {Number(position?.rawCollateral).toLocaleString()}{` `}{collateralToken?.symbol}
                                </td>
                                <td>
                                    {Number(position?.entryValue).toLocaleString()}{` `}{collateralToken?.symbol}
                                </td>
                                <td>
                                    {Number(position?.pnl) > 0 && "+"}{Number(position?.pnl).toLocaleString()}{` `}{collateralToken?.symbol}
                                </td>
                                <td>
                                    <Button onClick={() => onClosePosition()} color="secondary" size="sm">
                                        Close
                                    </Button>
                                </td>
                            </tr>
                        </tbody>

                    </Table>
                </div>
            }
        </Wrapper>
    )
}

export default Position