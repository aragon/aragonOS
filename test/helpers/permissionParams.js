const permissionParamEqOracle = (oracleAddress) => {
  // Set role such that the Oracle canPerform() function is used to determine the permission
  const argId = '0xCB' // arg 203 - Oracle ID
  const op = '01'      // equal
  const value = oracleAddress.slice(2).padStart(60, 0) // 60 as params are uint240
  return new web3.BigNumber(`${argId}${op}${value}`)
}

module.exports = {
  permissionParamEqOracle
}
