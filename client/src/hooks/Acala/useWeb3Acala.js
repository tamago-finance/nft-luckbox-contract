import React, {
  useEffect,
  useMemo,
  createContext,
  useState,
  useContext,
  useCallback,
} from "react"
import { ApiPromise, WsProvider } from "@polkadot/api"
import { Provider as AcalaProvider, Wallet } from "@acala-network/bodhi"
import { options } from "@acala-network/api"
import {
  web3Accounts,
  web3Enable,
  isWeb3Injected,
} from "@polkadot/extension-dapp"

import { NetworkContext } from "../useNetwork"

export const Web3AcalaContext = createContext({})

const Provider = ({ children }) => {
  const { currentNetwork } = useContext(NetworkContext)
  const [acalaAccount, setAcalaAccount] = useState("")
  const [allAccounts, setAllAccounts] = useState([])
  const [acalaChainId, setAcalaChainId] = useState(0)
  const [acalaEvmProvider, setAcalaEvmProvider] = useState()
  const [acalaApi, setAcalaApi] = useState()
  const [blindEthAddress, setBlindEthAddress] = useState()
  const [tick, setTick] = useState(0)

  const injectWebPolkadot = async () => {
    await web3Enable("Tamago Finance")
    const provider = new WsProvider("wss://mandala6.laminar.codes")
    const api = new ApiPromise(options({ provider }))
    await api.isReady
    setAcalaApi(api)
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
  }, [currentNetwork, acalaAccount])

  const getBlindEthAddress = useCallback(async () => {
    const isClaim = await acalaApi.query.evmAccounts.evmAddresses(
      acalaAccount.address
    )
    return isClaim.toHuman()
  }, [currentNetwork, acalaAccount])

  const getAllAccounts = async () => {
    const allAccounts = await web3Accounts()
    allAccounts.reverse()
    setAcalaAccount(allAccounts[0])
    setAllAccounts(allAccounts)
  }

  const increaseTick = useCallback(() => {
    setTick(tick + 1)
  }, [tick])

  useEffect(async () => {
    if (currentNetwork !== 2) return
    await injectWebPolkadot()
    await getAllAccounts()
    getAcalaEvmProvider().then(setAcalaEvmProvider)
    acalaApi && getBlindEthAddress().then(setBlindEthAddress)
  }, [currentNetwork])

  useEffect(async () => {
    if (!acalaApi && !acalaEvmProvider) return
    getBlindEthAddress().then(setBlindEthAddress)
  }, [currentNetwork, acalaAccount, blindEthAddress, tick])

  const web3AcalaContext = useMemo(
    () => ({
      acalaEvmProvider,
      acalaApi,
      acalaChainId,
      acalaAccount,
      allAccounts,
      setAcalaAccount,
      blindEthAddress,
      increaseTick,
    }),
    [
      acalaAccount,
      setAcalaAccount,
      allAccounts,
      currentNetwork,
      acalaEvmProvider,
      blindEthAddress,
      increaseTick,
    ]
  )

  return (
    <Web3AcalaContext.Provider value={web3AcalaContext}>
      {children}
    </Web3AcalaContext.Provider>
  )
}

export default Provider
