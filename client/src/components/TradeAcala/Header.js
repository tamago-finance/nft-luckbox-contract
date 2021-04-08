import styled from "styled-components"
import { ArrowLeft } from "react-feather"
import { useHistory } from "react-router-dom"

const Header = styled(({ className, name, symbol }) => {
  let history = useHistory()

  const back = () => {
    history.push("/acala")
  }

  return (
    <div className={className}>
      <ArrowLeft size={24} className='icon' onClick={() => back()} />
      <h3>{name}</h3>
      <span>{symbol}</span>
    </div>
  )
})`
  display: flex;
  flex-direction: row;
  align-items: center;

  .icon {
    cursor: pointer;
  }

  h3 {
    margin-left: 5px;
    margin-right: 5px;
  }
  span {
    font-weight: 600;
    color: var(--secondary);
  }
`

export default Header
