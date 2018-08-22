// Only runs given test block when the condition passes
const onlyIf = condition => {
    return testBlock => {
        if (condition()) {
            return testBlock()
        }
    }
}

module.exports = {
  onlyIf
}
