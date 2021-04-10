import React, { useState, useCallback, useContext } from "react"
import styled from "styled-components"
import { Alert, Button, Table } from "reactstrap"
import { useWeb3React } from "@web3-react/core"
import Web3 from "web3"
import { ethers } from "ethers"
import { web3FromAddress } from "@polkadot/extension-dapp"
import { ContractContext } from "../../hooks/useContract"
import useInterval from "../../hooks/useInterval"
import { useToasts } from "../../hooks/useToasts"
import { processingToast } from "../../utils"
import Perpetual from "../../abi/Perpetual.json"
import { CONTRACTS, TOKENS } from "../../constants"
import { Web3AcalaContext } from "../../hooks/Acala/useWeb3Acala"

const Wrapper = styled.div`
  border: 1px solid black;
  min-height: 200px;
  background: white;
  margin-top: 20px;
`

const Position = ({ currentToken, setLocked }) => {
  const { chainId } = useWeb3React()
  const { collateralToken, perpetuals, increaseTick } = useContext(
    ContractContext
  )
  const { acalaApi, acalaAccount, blindEthAddress } = useContext(
    Web3AcalaContext
  )
  const web3 = new Web3("wss://mandala6.laminar.codes")

  const perpetual = perpetuals[currentToken?.symbol]
  const [position, setPosition] = useState()

  const { add, update } = useToasts()

  const perpetualAddress = new web3.eth.Contract(
    Perpetual.abi,
    perpetual.perpetualAddress
  )

  useInterval(() => {
    if (perpetual) {
      ;(async () => {
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
    const injector = await web3FromAddress(acalaAccount.address)
    acalaApi.setSigner(injector.signer)
    const inputData = perpetualAddress.methods.closePosition().encodeABI()
    try {
      await acalaApi.tx.evm
        .call(
          perpetual.perpetualAddress,
          inputData,
          "0",
          "300000000",
          "4294967295"
        )
        .signAndSend(acalaAccount.address, async (status) => {
          const { status: newStatus } = status.toHuman()
          let id
          if (Object.keys(newStatus)[0] === "InBlock") {
            update({
              id,
              ...processingToast(
                "Closed",
                "Your transaction is completed",
                false,
                "",
                0
              ),
            })
            increaseTick()
          } else if (Object.keys(newStatus)[0] === "Broadcast") {
            id = add(
              processingToast(
                "Closing",
                "Your transaction is being processed",
                true,
                "",
                0
              )
            )
          }
        })
    } catch (e) {
      add(
        processingToast(
          "Error",
          "Insufficient balances on Acala token",
          false,
          "",
          0
        )
      )
    }
  }, [perpetual, chainId])

  return (
    <Wrapper>
      {!position ? (
        <div style={{ textAlign: "center", marginTop: 80 }}>
          You have no position
        </div>
      ) : (
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
                <th scope='row'>{position?.side}</th>
                <td>
                  {position?.positionSize}
                  {` `}
                  {currentToken?.symbol}
                </td>
                <td>
                  {Number(position?.rawCollateral).toLocaleString()}
                  {` `}
                  {collateralToken?.symbol}
                </td>
                <td>
                  {Number(position?.entryValue).toLocaleString()}
                  {` `}
                  {collateralToken?.symbol}
                </td>
                <td>
                  {Number(position?.pnl) > 0 && "+"}
                  {Number(position?.pnl).toLocaleString()}
                  {` `}
                  {collateralToken?.symbol}
                </td>
                <td>
                  <Button
                    onClick={() => onClosePosition()}
                    color='secondary'
                    size='sm'
                  >
                    Close
                  </Button>
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}
    </Wrapper>
  )
}

export default Position
