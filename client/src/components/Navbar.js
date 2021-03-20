import React, { useState, useCallback, useEffect } from 'react';
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
import {
    Mail,
    Menu,
    MoreVertical,
    User,
    Inbox,
    Phone,
    Calendar,
    Lock,
    LogOut,
    Shield
} from "react-feather";
import { Link } from "react-router-dom"
import Blockies from 'react-blockies';
import { Web3ReactProvider, useWeb3React, UnsupportedChainIdError } from '@web3-react/core'
import Logo from "../assets/img/logo-2.png"

import {
    injected
} from "../connectors"

const Brand = styled.img.attrs(props => ({
    src: Logo
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


const Main = () => {

    const [isOpen, setOpen] = useState(false);

    const toggle = useCallback(() => {
        setOpen(!isOpen)
    }, [isOpen])

    return (
        <>
            <Wrapper color="transparent" light expand="md">
                <Container>
                    <NavbarBrand>
                        <Link to="/">
                            <Brand />
                        </Link>
                    </NavbarBrand>
                    <NavbarToggler onClick={toggle} />
                    <Collapse isOpen={isOpen} navbar>
                        <Nav className="ml-auto" navbar>
                            <NavItem>
                                <NavLink>
                                    <Link to="/">Trade</Link>
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink>
                                    <Link to="/liquidity">Liquidity</Link>
                                </NavLink>
                            </NavItem>
                            {/* <NavItem>
                                <NavLink>
                                    <a target="_blank" href="https://github.com/pisuthd/hotpotswap">GitHub</a>
                                </NavLink>
                            </NavItem> */}
                            {!false
                                ?
                                <Button color="info" onClick={() => { }}>
                                    Connect Wallet
                                </Button>
                                :
                                <UncontrolledDropdown className="pr-1">
                                    <DropdownToggle nav >
                                        <Blockies
                                            // seed={account}
                                            className="rounded-circle width-35"
                                        />
                                    </DropdownToggle>
                                    {/* <DropdownMenu right>
                                        <DropdownItem disabled>
                                            xxxx
                                        </DropdownItem>
                                        <DropdownItem divider />
                                        <DropdownItem >
                                            <div
                                                onClick={() => {
                                                    deactivate()
                                                }}
                                            >
                                                <LogOut size={16} className="mr-1" /> Exit
                                                    </div>
                                        </DropdownItem>
                                    </DropdownMenu> */}
                                </UncontrolledDropdown>
                            }
                        </Nav>
                    </Collapse>
                </Container>
            </Wrapper>
        </>
    )
}

export default Main
