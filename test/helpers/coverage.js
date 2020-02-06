const skipCoverage = test => {
    // Required dynamic this binding to attach onto the running test
    return function skipCoverage() {
        if (process.env.SOLIDITY_COVERAGE === 'true') {
            this.skip()
        } else {
            return test()
        }
    }
}

// For some reason, adding skipCoverage() to `before()`s were not working
const skipSuiteCoverage = suite => {
  return process.env.SOLIDITY_COVERAGE === 'true' ? suite.skip : suite
}

module.exports = {
  skipCoverage,
  skipSuiteCoverage,
}
