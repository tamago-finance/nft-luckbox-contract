import React, {
  useEffect,
  useMemo,
  createContext,
  useState,
  useContext,
  useCallback,
} from "react"
import { ethers } from "ethers"
import { ApiPromise, WsProvider } from "@polkadot/api"
import { Provider as AcalaProvider, Wallet } from "@acala-network/bodhi"
import { options } from "@acala-network/api"
import {
  web3Accounts,
  web3Enable,
  isWeb3Injected,
} from "@polkadot/extension-dapp"
import Perpetual from "../../abi/Perpetual.json"

import { NetworkContext } from "../useNetwork"

export const Web3AcalaContext = createContext({})

const Provider = ({ children }) => {
  const { currentNetwork } = useContext(NetworkContext)
  const [acalaAccount, setAcalaAccount] = useState("")
  const [allAccounts, setAllAccounts] = useState([])
  const [acalaChainId, setAcalaChainId] = useState(0)
  const [acalaEvmProvider, setAcalaEvmProvider] = useState()

  const injectWebPolkadot = async () => {
    await web3Enable("Tamago Finance")
    const provider = new WsProvider("wss://mandala6.laminar.codes/ws")
    const api = new ApiPromise(options({ provider }))
    await api.isReady
  }

  const getAcalaEvmProvider = useCallback(async () => {
    const provider = new AcalaProvider(
      options({
        provider: new WsProvider("wss://mandala6.laminar.codes"),
      })
    )
    await provider.init()
    const { chainId } = await provider.getNetwork()
    setAcalaChainId(chainId)
    return provider
  })

  const getAllAccounts = useCallback(async () => {
    const allAccounts = await web3Accounts()
    setAcalaAccount(allAccounts[0])
    return allAccounts
  })

  useEffect(async () => {
    if (currentNetwork !== 2) return
    injectWebPolkadot()
    getAllAccounts().then(setAllAccounts)
    getAcalaEvmProvider().then(setAcalaEvmProvider)
  }, [currentNetwork])

  const web3AcalaContext = useMemo(
    () => ({
      acalaEvmProvider,
      acalaChainId,
      acalaAccount,
      allAccounts,
      setAcalaAccount,
    }),
    [
      acalaAccount,
      setAcalaAccount,
      allAccounts,
      currentNetwork,
      acalaEvmProvider,
    ]
  )

  return (
    <Web3AcalaContext.Provider value={web3AcalaContext}>
      {children}
    </Web3AcalaContext.Provider>
  )
}

export default Provider
