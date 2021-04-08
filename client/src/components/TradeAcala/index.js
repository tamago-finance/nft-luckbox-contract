import React, { useState, useCallback, useContext, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useWeb3React } from "@web3-react/core"
import styled from "styled-components"
import { Row, Col } from "reactstrap"
import TradingViewWidget from "react-tradingview-widget"
import { CONTRACTS, TOKENS } from "../../constants"
import { ContractContext } from "../../hooks/useContract"
import { Web3AcalaContext } from "../../hooks/Acala/useWeb3Acala"
import { NetworkContext } from "../../hooks/useNetwork"
import Header from "./Header"
import Stats from "./Stats"
import TradePanel from "./TradePanel"
import Position from "./Position"

const Wrapper = styled.div``

const StyledRow = styled(Row)`
  margin-bottom: 40;
`

const StyledCol = styled(Col)``

const TradingViewContainer = styled.div`
  height: 400px;
`

const TradeAcala = () => {
  const location = useLocation()
  const { chainId, account, active, error, library } = useWeb3React()
  const { perpetuals, collateralToken } = useContext(ContractContext)
  const { currentNetwork } = useContext(NetworkContext)
  const [currentToken, setToken] = useState()
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (location && location.pathname && chainId) {
      const contractAddress = location.pathname.split("/trade/")[1]
      let token
      if (chainId === 1337 && currentNetwork !== 2) {
        token = TOKENS.LOCAL.find(
          (item) => item.address.toLowerCase() === contractAddress.toLowerCase()
        )
      } else if (chainId === 42 && currentNetwork !== 2) {
        token = TOKENS.KOVAN.find(
          (item) => item.address.toLowerCase() === contractAddress.toLowerCase()
        )
      } else if (currentNetwork === 2) {
        token = TOKENS.ACALA.find(
          (item) => item.address.toLowerCase() === contractAddress.toLowerCase()
        )
        console.log(token)
      }
      setToken(token)
    }
  }, [chainId, location.pathname])

  if (!currentToken) {
    return <div> Your're not login </div>
  }

  return (
    <Wrapper>
      <Header name={currentToken?.name} symbol={currentToken?.symbol} />
      <Stats
        perpetual={perpetuals[currentToken?.symbol]}
        collateralToken={collateralToken}
        symbol={currentToken?.symbol}
      />
      <StyledRow>
        <StyledCol xs='4'>
          <TradePanel
            perpetual={perpetuals[currentToken?.symbol]}
            collateralToken={collateralToken}
            symbol={currentToken?.symbol}
            locked={locked}
          />
        </StyledCol>
        <StyledCol xs='8'>
          <TradingViewContainer>
            <TradingViewWidget
              symbol={
                currentToken?.symbol === "renBTC"
                  ? `BTCUSD`
                  : `${currentToken?.symbol}USD`
              }
              autosize
            />
          </TradingViewContainer>
          <Position currentToken={currentToken} setLocked={setLocked} />
        </StyledCol>
      </StyledRow>
    </Wrapper>
  )
}

export default TradeAcala
