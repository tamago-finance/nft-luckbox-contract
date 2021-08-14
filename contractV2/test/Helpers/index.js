

exports.fromEther = (value) => {
    return ethers.utils.formatEther(value)
}

exports.toEther = (value) => {
    return ethers.utils.parseEther(`${value}`)
}
