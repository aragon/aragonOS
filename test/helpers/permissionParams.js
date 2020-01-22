
const paramForOracle = (oracleAddress) => {
  // Set role such that the Oracle canPerform() function is used to determine the permission
  const argId = '0xCB' // arg 203 - Oracle ID
  const op = '01'      // equal
  const value = `00000000000000000000${oracleAddress.slice(2)}`
  return new web3.BigNumber(`${argId}${op}${value}`)
}

module.exports = {
  paramForOracle
}