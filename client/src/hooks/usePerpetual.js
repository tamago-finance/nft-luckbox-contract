import { useMemo, useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import Perpetual from "../abi/Perpetual.json"
import { useERC20 } from "./useERC20"

const Side = {
    FLAT: 0,
    SHORT: 1,
    LONG: 2,
}

const Leverage = {
    ONE: 0,
    TWO: 1,
    THREE: 2,
    FOUR: 3
}

const PositionStatus = {
    SAFE: 0,
    WARNING: 1,
    DANGER: 2
}

export const usePerpetual = (perpetualAddress, account, library, tick) => {

    const perpetualContract = useMemo(() => {
        if (!account || !perpetualAddress || !library) {
            return
        }

        return new ethers.Contract(perpetualAddress, Perpetual.abi, library.getSigner())
    }, [account, perpetualAddress, library])

    const [markPrice, setMarkPrice] = useState("--")
    const [totalLiquidity, setTotalLiquidity] = useState("--")

    const getMarkPrice = useCallback(
        async () => {
            try {
                const result = await perpetualContract.getMidPrice()
                return Number(ethers.utils.formatEther(result)).toLocaleString()
            } catch (e) {
                return "0"
            }
        },

        [perpetualContract, account]
    );

    const getTotalLiquidity = useCallback(
        async () => {
            try {
                const result = await perpetualContract.totalLiquidity()
                return (Number(ethers.utils.formatEther(result.quote))*2).toLocaleString()
            } catch (e) { 
                return "0"
            }
        },

        [perpetualContract, account]
    );

    useEffect(() => {

        perpetualContract && getMarkPrice().then(setMarkPrice)
        perpetualContract && getTotalLiquidity().then(setTotalLiquidity)

    }, [account, perpetualContract, tick])

    return {
        perpetualAddress,
        markPrice,
        totalLiquidity
    }

}