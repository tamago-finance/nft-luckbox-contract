import React, {
  useEffect,
  useMemo,
  createContext,
  useState,
  useContext,
  useCallback,
} from "react"
import { ApiPromise } from "@polkadot/api"
import { WsProvider } from "@polkadot/rpc-provider"
import { options } from "@acala-network/api"
import {
  web3Accounts,
  web3Enable,
  isWeb3Injected,
} from "@polkadot/extension-dapp"

import { NetworkContext } from "../hooks/useNetwork"

export const Web3AcalaContext = createContext({})

const Provider = ({ children }) => {
  const { currentNetwork } = useContext(NetworkContext)
  const [acalaAccount, setAcalaAccount] = useState("")
  const [allAccounts, setAllAccounts] = useState([])

  const injectWebPolkadot = async () => {
    await web3Enable("Tamago Finance")
    const provider = new WsProvider("wss://testnet-node-1.acala.laminar.one/ws")
    const api = new ApiPromise(options({ provider }))
    await api.isReady
  }

  const getAllAccounts = useCallback(async () => {
    const allAccounts = await web3Accounts()
    setAcalaAccount(allAccounts[0])
    return allAccounts
  })

  useEffect(async () => {
    if (currentNetwork !== 2) return

    injectWebPolkadot()
    getAllAccounts().then(setAllAccounts)
  }, [currentNetwork])

  const web3AcalaContext = useMemo(
    () => ({
      acalaAccount,
      allAccounts,
      setAcalaAccount,
    }),
    [acalaAccount, setAcalaAccount, allAccounts]
  )

  return (
    <Web3AcalaContext.Provider value={web3AcalaContext}>
      {children}
    </Web3AcalaContext.Provider>
  )
}

export default Provider
