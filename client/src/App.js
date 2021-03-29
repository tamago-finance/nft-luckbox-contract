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

const getLibrary = (provider) => {
  const library = new ethers.providers.Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <ContractProvider>
        <ToastProvider>
          <NetworkProvider>
            <Router>
              <Navbar />
              <Routes />
            </Router>
          </NetworkProvider>
        </ToastProvider>
      </ContractProvider>
    </Web3ReactProvider>
  )
}

export default App
