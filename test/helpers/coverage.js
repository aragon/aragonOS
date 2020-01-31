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

module.exports = {
  skipCoverage
}
