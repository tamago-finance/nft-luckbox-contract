import styled from "styled-components"
import { Web3ReactProvider } from "@web3-react/core"
import { ethers } from "ethers"
import {
  BrowserRouter as Router,
  Switch,
  Redirect,
  Route,
} from "react-router-dom"
import Navbar from "./components/Navbar"
import Routes from "./components/Routes"
import ToastProvider from "./hooks/useToasts"
import ContractProvider from "./hooks/useContract"
import NetworkProvider from "./hooks/useNetwork"
import Web3AcalaProvider from "./hooks/useWeb3Acala"

const getLibrary = (provider) => {
  const library = new ethers.providers.Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <NetworkProvider>
        <Web3AcalaProvider>
          <ContractProvider>
            <ToastProvider>
              <Router>
                <Navbar />
                <Routes />
              </Router>
            </ToastProvider>
          </ContractProvider>
        </Web3AcalaProvider>
      </NetworkProvider>
    </Web3ReactProvider>
  )
}

export default App
