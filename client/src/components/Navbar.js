import React, { useState, useCallback, useEffect, useContext } from "react"
import styled from "styled-components"
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Row,
  Container,
  Col,
  NavItem,
  NavLink,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  UncontrolledDropdown,
  NavbarText,
  Button,
  Badge,
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
} from "reactstrap"
import { ChevronDown, LogOut } from "react-feather"
import { Link } from "react-router-dom"
import Blockies from "react-blockies"
import {
  Web3ReactProvider,
  useWeb3React,
  UnsupportedChainIdError,
} from "@web3-react/core"
import { NetworkContext } from "../hooks/useNetwork"
import { Web3AcalaContext } from "../hooks/useWeb3Acala"
import Logo from "../assets/img/logo-2.png"
import { useToasts } from "../hooks/useToasts"
import MetamaskSVG from "../assets/img/metamask.svg"
import useEagerConnect from "../hooks/useEagerConnect"
import useInactiveListener from "../hooks/useInactiveListener"
import { shortAddress } from "../utils"
import { injected } from "../connectors"

const Brand = styled.img.attrs((props) => ({
  src: Logo,
}))`
  height: 60px;
`

const Wrapper = styled(Navbar)`
  min-height: 80px;

  a {
    color: inherit;
    cursor: pointer;
    margin-left: 5px;
    margin-right: 5px;

    :first-child {
      margin-left: 0px;
      margin-right: 10px;
    }
  }
`

const Connector = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 5px;

  font-size: 18px;
  font-weight: 600;
  text-transform: uppercase;

  :hover {
    cursor: pointer;
    color: white;
    background-image: linear-gradient(
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 0)
      ),
      linear-gradient(101deg, #78e4ff, #ff48fa);
    background-origin: border-box;
    background-clip: content-box, border-box;
    box-shadow: none;
  }

  display: flex;
  flex-direction: row;

  img {
    width: 48px;
    height: 48px;
  }

  div {
    flex: 70%;
    display: flex;
    align-items: center;

    :first-child {
      flex: 20%;
    }
    :last-child {
      flex: 10%;
    }
  }
`

const Connectors = [
  {
    name: "Metamask",
    connector: injected,
    icon: MetamaskSVG,
  },
]

const Main = () => {
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
  const { currentNetwork } = useContext(NetworkContext)
  const { acalaAccount, setAcalaAccount, allAccounts } = useContext(
    Web3AcalaContext
  )
  const { add } = useToasts()
  const [loginModal, setLoginModal] = useState(false)
  const [locked, setLocked] = useState(false)

  const [isOpen, setOpen] = useState(false)

  // handle logic to recognize the connector currently being activated
  const [activatingConnector, setActivatingConnector] = useState()

  // handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already
  const triedEager = useEagerConnect()

  // handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists
  useInactiveListener(!triedEager || !!activatingConnector)

  const toggle = useCallback(() => {
    setOpen(!isOpen)
  }, [isOpen])

  const toggleModal = useCallback(() => {
    setLoginModal(!loginModal)
    if (!loginModal) {
      setLocked(false)
    }
  }, [loginModal])

  useEffect(() => {
    if (currentNetwork !== 1) return
    if (error && error.name === "UnsupportedChainIdError" && !locked) {
      setLocked(true)
      add({
        title: "Unsupported Network",
        content: <div>Please switch to Kovan network</div>,
      })
    }
  }, [error, locked])

  return (
    <>
      <Wrapper color='transparent' light expand='md'>
        <Container>
          <NavbarBrand>
            <Link to='/'>
              <Brand />
            </Link>
            {currentNetwork === 1 && chainId === 42 && (
              <Badge size='sm' color='warning'>
                Kovan
              </Badge>
            )}
            {currentNetwork === 1 && chainId === 1337 && (
              <Badge size='sm' color='dark'>
                Dev
              </Badge>
            )}
            {currentNetwork === 2 && (
              <Badge size='sm' color='info'>
                Acala
              </Badge>
            )}
          </NavbarBrand>
          <NavbarToggler onClick={toggle} />
          <Collapse isOpen={isOpen} navbar>
            <Nav className='ml-auto' navbar>
              <NavItem>
                <NavLink>
                  <Link to='/'>Trade</Link>
                </NavLink>
              </NavItem>
              {/* <NavItem>
                                <NavLink>
                                    <Link to="/liquidity">Liquidity</Link>
                                </NavLink>
                            </NavItem> */}
              <NavItem>
                <NavLink>
                  <a
                    target='_blank'
                    href='https://github.com/tamago-finance/tamago-finance'
                  >
                    GitHub
                  </a>
                </NavLink>
              </NavItem>
              {currentNetwork === 0 || currentNetwork === 1 ? (
                !account ? (
                  <Button color='info' onClick={toggleModal}>
                    Connect Wallet
                  </Button>
                ) : (
                  <UncontrolledDropdown className='pr-1'>
                    <DropdownToggle nav>
                      {/* <Blockies
                                              seed={account}
                                              className="rounded-circle width-35"
                                          /> */}
                      {shortAddress(account)}
                      {` `}
                      <ChevronDown size={18} />
                    </DropdownToggle>
                    <DropdownMenu right>
                      {/* <DropdownItem disabled>
                                              <div className="font-small-3">
                                                  {shortAddress(account)}
                                              </div>
                                          </DropdownItem>
                                          <DropdownItem divider /> */}
                      <DropdownItem>
                        <div
                          onClick={() => {
                            deactivate()
                          }}
                        >
                          <LogOut size={16} className='mr-1' /> Logout
                        </div>
                      </DropdownItem>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                )
              ) : !acalaAccount ? (
                <Button color='info' onClick={toggleModal}>
                  Connect Wallet
                </Button>
              ) : (
                <UncontrolledDropdown className='pr-1'>
                  <DropdownToggle nav>
                    {shortAddress(acalaAccount.address)}
                    <ChevronDown size={18} />
                  </DropdownToggle>
                  <DropdownMenu right>
                    {allAccounts.map((account, index) => (
                      <DropdownItem
                        onClick={() => setAcalaAccount(account)}
                        key={index}
                      >
                        {shortAddress(account.address)}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </UncontrolledDropdown>
              )}
            </Nav>
          </Collapse>
        </Container>
      </Wrapper>
      <Modal isOpen={loginModal} toggle={toggleModal}>
        <ModalHeader toggle={toggleModal}>Choose Wallet Provider</ModalHeader>
        <ModalBody>
          {Connectors.map((item, index) => {
            const { connector, name, icon } = item
            return (
              <Connector
                key={index}
                onClick={() => {
                  setActivatingConnector(connector)
                  activate(connector)
                  setLoginModal(false)
                }}
              >
                <div>
                  <img src={icon} alt={`wallet-icon-${index}`} />
                </div>
                <div>{name}</div>
                <div>{/* TODO : PUT CONNECTION STATUS */}</div>
              </Connector>
            )
          })}
        </ModalBody>
        <ModalFooter>
          <Button color='secondary' onClick={toggleModal}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default Main
