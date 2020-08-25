const { getEventAt } = require('@aragon/contract-helpers-test')

const ASSERT_LIB_EVENTS_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "result",
        "type": "bool"
      },
      {
        "indexed": false,
        "name": "message",
        "type": "string"
      }
    ],
    "name": "TestEvent",
    "type": "event"
  },
]

const HOOKS_MAP = {
  beforeAll: 'before',
  beforeEach: 'beforeEach',
  afterEach: 'afterEach',
  afterAll: 'afterAll',
}

/*
 * Deploy and link `libName` to provided contract artifact
*/
const linkLib = async (contract, libName) => {
  const library = await artifacts.require(libName).new()
  await contract.link(library)
}

/**
 * Runs a solidity test file, via javascript.
 * Required to smooth over some technical problems in solidity-coverage
 *
 * @param {string} testContract Name of solidity test file
*/
function runSolidityTest(testContract, mochaContext) {
  const artifact = artifacts.require(testContract)

  contract(testContract, () => {
    let deployed

    before(async () => {
      await linkLib(artifact, 'Assert')
      deployed = await artifact.new()
    })

    const assertResult = async call => {
      const receipt = await call()
      const { args: { result, message } } = getEventAt(receipt, 'TestEvent', { decodeForAbi: ASSERT_LIB_EVENTS_ABI })
      if (!result) throw new Error(message || 'No assertions made')
    }

    mochaContext('> Solidity test', () => {
      artifact.abi.forEach(interface => {
        if (interface.type === 'function') {
          // Set up hooks
          if (['beforeAll', 'beforeEach', 'afterEach', 'afterAll'].includes(interface.name)) {
            global[HOOKS_MAP[interface.name]](async () => await deployed[interface.name]())
          } else if (interface.name.startsWith('test')) {
            it(interface.name, async () => await assertResult(deployed[interface.name]))
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
