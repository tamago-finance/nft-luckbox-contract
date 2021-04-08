import React, { useState, useCallback, useContext, useMemo } from "react"
import styled from "styled-components"
import { Row, Col, Table, Badge } from "reactstrap"
import { useHistory } from "react-router-dom"
import { TOKENS } from "../../constants"
import AssetIcon from "../common/AssetIcon"
import { ContractContext } from "../../hooks/useContract"

const TokenList = styled(({ className, currentNetwork }) => {
  let history = useHistory()
  const { collateralToken, perpetuals } = useContext(ContractContext)

  const LIST = useMemo(() => {
    if (currentNetwork === 1) {
      return TOKENS.KOVAN
    } else if (currentNetwork === 2) {
      return TOKENS.ACALA
    }

    return TOKENS.LOCAL
  }, [currentNetwork])

  const toTrading = (address) => {
    history.push(`/acala/trade/${address}`)
  }

  return (
    <div className={className}>
      <Row>
        {LIST.map((item, index) => {
          return (
            <Col onClick={() => toTrading(item?.address)} key={index} lg='4'>
              <div className='card'>
                <div className='card-icon'>
                  <AssetIcon symbol={item?.symbol} />
                </div>
                <div className='card-content'>
                  <h2>{item?.symbol}</h2>
                  <h4>
                    {item?.name}
                    <Badge color='warning' style={{ marginLeft: 5 }}>
                      4x
                    </Badge>
                  </h4>
                  <Table>
                    <tbody>
                      <tr>
                        <td>Index Price</td>
                        <td>{perpetuals[item.symbol].indexPrice}</td>
                      </tr>
                      <tr>
                        <td>Mark Price</td>
                        <td>{perpetuals[item.symbol].markPrice}</td>
                      </tr>
                      <tr>
                        <td>Liquidity</td>
                        <td>{perpetuals[item.symbol].totalLiquidity}</td>
                      </tr>
                      <tr>
                        <td>Collateral</td>
                        <td>{collateralToken.symbol}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
})`
  .card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    padding-top: 10px;
    padding-bottom: 10px;
    background: transparent;
    display: flex;
    flex-direction: row;
    cursor: pointer;
    overflow: hidden;

    h4 {
      font-size: 18px;
      color: var(--secondary);
    }

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
      h4 {
        color: white;
        opacity: 0.8;
      }
    }
    h2,
    h4 {
      margin: 0;
    }

    h4 {
      margin-bottom: 20px;
    }

    table {
      font-size: 12px;
      td {
        padding: 0px;
        padding-top: 7px;
        padding-bottom: 7px;
      }
    }
  }

  .card-icon {
    flex: 40%;
  }

  .card-content {
    flex: 60%;
  }

  @media screen and (max-width: 450px) {
    margin-top: 0px;
    .card {
      margin-top: 20px;
    }
  }
`

export default TokenList
