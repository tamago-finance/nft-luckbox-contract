import styled from "styled-components"
import TeslaSVG from "../../assets/img/tesla-logo.svg"
import AppleSVG from "../../assets/img/apple-logo.svg"

const Icon = styled.img.attrs(props => ({
    src: props.src
}))`
    height: 80px; 
`


const AssetIcon = ({ symbol }) => {

    let source

    switch (symbol) {
        case "AAPL":
            source = AppleSVG
            break;
        case "TSLA":
            source = TeslaSVG
            break;
        default:
            break;
    }

    return (
       <Icon
            src={source}
       />
    )
}

export default AssetIcon