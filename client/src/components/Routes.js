import React, { useState, useCallback } from "react"
import {
  BrowserRouter as Router,
  Switch,
  Redirect,
  Route,
  Link,
  useLocation,
} from "react-router-dom"
import styled from "styled-components"
import {
  Web3ReactProvider,
  useWeb3React,
  UnsupportedChainIdError,
} from "@web3-react/core"
import {
  Container,
  Jumbotron,
  Row,
  Col,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Input,
  Nav,
  NavItem,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  DropdownMenu,
  NavLink,
} from "reactstrap"

// import Trade from "./Trade"
import Liquidity from "./Liquidity"
import Home from "./Home"
import HomeAcala from "./HomeAcala"
import Trade from "./Trade"
import TradeAcala from "./TradeAcala"

const Wrapper = styled(Container)`
  margin-top: 20px;
`

const Routes = () => {
  const context = useWeb3React()
  const {
    connector,
    library,
    chainId,
    account,
    activate,
    deactivate,
    active,
    error,
  } = context
  const location = useLocation()

  return (
    <Wrapper>
      <Switch>
        <Route exact path='/'>
          <Home />
        </Route>
        <Route exact path='/acala'>
          <HomeAcala />
        </Route>
        <Route path='/acala/trade'>
          <TradeAcala />
        </Route>
        <Route path='/trade'>
          <Trade />
        </Route>
        <Route exact path='/liquidity'>
          <Liquidity />
        </Route>
        <Redirect to='/' />
      </Switch>
    </Wrapper>
  )
}

export default Routes
