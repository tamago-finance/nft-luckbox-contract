import styled from "styled-components"
import TeslaSVG from "../../assets/img/tesla-logo.svg"
import AppleSVG from "../../assets/img/apple-logo.svg"
import BtcSVG from "../../assets/img/btc-logo.png"
import DotSVG from "../../assets/img/dot-logo.png"

const Icon = styled.img.attrs((props) => ({
  src: props.src,
}))`
  height: 80px;
`

const AssetIcon = ({ symbol }) => {
  let source

  switch (symbol) {
    case "AAPL":
      source = AppleSVG
      break
    case "TSLA":
      source = TeslaSVG
      break
    case "renBTC":
      source = BtcSVG
      break
    case "DOT":
      source = DotSVG
      break
    default:
      break
  }

  return <Icon src={source} />
}

export default AssetIcon
