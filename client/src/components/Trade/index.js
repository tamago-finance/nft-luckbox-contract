import React, { useState, useCallback, useEffect } from 'react'
import { useLocation } from "react-router-dom"

const Trade = () => {

    const location = useLocation()

    const [ perpertualAddress, setPerpetual ] = useState()

    useEffect(() => {

        if (location && location.pathname) {
            const contractAddress = location.pathname.split("/trade/")[1]
            setPerpetual(contractAddress)
        }

    }, [location.pathname])

    

    if (!perpertualAddress) {
        return <div> No contract address has been given </div>
    }

    return (
        <div>
            Under construction
        </div>
    )
}

export default Trade