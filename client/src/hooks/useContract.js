import React, {
  useEffect,
  useMemo,
  useReducer,
  createContext,
  useState,
  useContext,
  useCallback,
} from "react"
import {
  Web3ReactProvider,
  useWeb3React,
  UnsupportedChainIdError,
} from "@web3-react/core"
import { ethers } from "ethers"
import { useERC20 } from "./useERC20"
import { usePerpetual } from "./usePerpetual"
import { CONTRACTS, TOKENS } from "../constants"
import { Web3AcalaContext } from "./Acala/useWeb3Acala"
import { NetworkContext } from "./useNetwork"

export const ContractContext = createContext({})

const Provider = ({ children }) => {
  const context = useWeb3React()
  const { acalaEvmProvider, acalaChainId } = useContext(Web3AcalaContext)
  const { currentNetwork } = useContext(NetworkContext)
  const { chainId, account, active, error, library } = context
  const [tick, setTick] = useState(0)
  let useChainId, useLibrary
  if (currentNetwork === 2) {
    useChainId = acalaChainId
    useLibrary = acalaEvmProvider
  } else {
    useChainId = chainId
    useLibrary = library
  }

  const collateralToken = useERC20(useChainId, account, useLibrary, tick)

  let appleAddress
  let teslaAddress
  const renBTCAddress = TOKENS.ACALA[0].address
  const dotAddress = TOKENS.ACALA[1].address
  if (chainId === 1337) {
    appleAddress = TOKENS.LOCAL[0].address
    teslaAddress = TOKENS.LOCAL[1].address
  } else if (chainId === 42) {
    appleAddress = TOKENS.KOVAN[0].address
    teslaAddress = TOKENS.KOVAN[1].address
  }

  const perpetuals = {
    AAPL: usePerpetual(appleAddress, account, library, tick),
    TSLA: usePerpetual(teslaAddress, account, library, tick),
    renBTC: usePerpetual(renBTCAddress, account, acalaEvmProvider, tick),
    DOT: usePerpetual(dotAddress, account, acalaEvmProvider, tick),
  }

  const increaseTick = useCallback(() => {
    setTick(tick + 1)
  }, [tick])

  const contractContext = useMemo(
    () => ({
      collateralToken,
      increaseTick,
      perpetuals,
    }),
    [collateralToken, increaseTick, perpetuals]
  )

  return (
    <ContractContext.Provider value={contractContext}>
      {children}
    </ContractContext.Provider>
  )
}

export default Provider
