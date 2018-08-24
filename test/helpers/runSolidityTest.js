const HOOKS_MAP = {
  beforeAll: 'before',
  beforeEach: 'beforeEach',
  afterEach: 'afterEach',
  afterAll: 'afterAll',
}

const processResult = receipt => {
  if (!receipt) {
    return
  }
  receipt.logs.forEach(log => {
    if (log.event === 'TestEvent' && log.args.result !== true) {
      throw new Error(log.args.message)
    }
  })
}

/**
 * Runs a solidity test file, via javascript.
 * Required to smooth over some technical problems in solidity-coverage
 *
 * @param {string} c Name of solidity test file
*/
function runSolidityTest(c, mochaContext) {
  const artifact = artifacts.require(c)
  contract(c, accounts => {
    let deployed

    before(async () => {
      deployed = await artifact.new()
    })

    mochaContext('> Solidity test', () => {
      artifact.abi.forEach(interface => {
        if (interface.type === 'function') {
          if (['beforeAll', 'beforeEach', 'afterEach', 'afterAll'].includes(interface.name)) {
            // Set up hooks
            global[HOOKS_MAP[interface.name]](() => {
              return deployed[interface.name]().then(processResult)
            })
          } else if (interface.name.startsWith('test')) {
            it(interface.name, () => {
              return deployed[interface.name]().then(processResult)
            })
          }
        }
      })
    })
  })
}

// Bind the functions for ease of use, and provide .only() and .skip() hooks
const fn = (c) => runSolidityTest(c, context)
fn.only = (c) => runSolidityTest(c, context.only)
fn.skip = (c) => runSolidityTest(c, context.skip)

module.exports = fn
