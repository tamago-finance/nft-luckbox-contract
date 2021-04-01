import styled from "styled-components";
import { Row, Col } from "reactstrap"

const Item = styled(Col).attrs(props => ({
    xs: props.xs ? props.xs : "2"
}))`
    
    h4 {
        margin: 0px;
        font-size: 16px;
    }
    p {
        margin: 0px;
    }

`

const Stats = styled(
    ({ className, perpetual, collateralToken, symbol }) => {

        return (
            <div className={className}>
                <Row>
                    <Item>
                        <h4>
                            Source
                        </h4>
                        <p>Tiingo</p>
                    </Item>
                    <Item>
                        <h4>
                            Period
                        </h4>
                        <p>EOD</p>
                    </Item>
                    <Item>
                        <h4>
                            Index Price
                        </h4>
                        <p>{0}{` `}{collateralToken.symbol}</p>
                    </Item>
                    <Item>
                        <h4>
                            Mark Price
                        </h4>
                        <p>{perpetual?.markPrice}{` `}{collateralToken.symbol}</p>
                    </Item>
                    <Item xs="4">
                        <h4>
                            Total Liquidity
                        </h4>
                        {/* <p>{perpetual?.totalLiquidity}{` `}{collateralToken.symbol}</p> */}
                        <p>{Number(perpetual?.liquidity?.availableQuote).toLocaleString()}{` `}{collateralToken.symbol} / {Number(perpetual?.liquidity?.availableBase).toLocaleString()}{` `}{symbol}</p>
                    </Item>
                    {/* <Item>
                        <h4>
                            Available(Long)
                        </h4>
                        <p>{perpetual?.liquidity?.availableQuote}{` `}{collateralToken.symbol}</p>
                    </Item>
                    <Item>
                        <h4>
                            Available(Short)
                        </h4>
                        <p>{perpetual?.liquidity?.availableBase}{` `}{symbol}</p>
                    </Item> */}
                </Row>
            </div>
        )
    })`

    margin-top: 20px;
    margin-bottom: 20px;

    `

export default Stats