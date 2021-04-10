import React, { useMemo, createContext, useState } from "react"

export const NetworkContext = createContext({})

const Provider = ({ children }) => {
  const [currentNetwork, setNetwork] = useState(1) // 0 - Dev, 1 - Kovan, 2 - Acala

  const networkContext = useMemo(
    () => ({
      currentNetwork,
      setNetwork,
    }),
    [setNetwork, currentNetwork]
  )

  return (
    <NetworkContext.Provider value={networkContext}>
      {children}
    </NetworkContext.Provider>
  )
}

export default Provider
