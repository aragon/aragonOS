const { decodeEventsOfType } = require('./decodeEvent')

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

const processResult = (txReceipt, mustAssert) => {
  if (!txReceipt || !txReceipt.receipt) {
    return
  }
  const decodedLogs = decodeEventsOfType(txReceipt.receipt, ASSERT_LIB_EVENTS_ABI, 'TestEvent')
  decodedLogs.forEach(log => {
    if (log.event === 'TestEvent' && log.args.result !== true) {
      throw new Error(log.args.message)
    }
  })
  if (mustAssert && !decodedLogs.length) {
    throw new Error('No assertions made')
  }
}

/*
 * Deploy and link `libName` to provided contract artifact.
 * Modifies bytecode in place
*/
const linkLib = async (contract, libName) => {
  const underscores = n => '_'.repeat(n)
  const PREFIX_UNDERSCORES = 2
  const ADDR_LENGTH = 40

  const prefix = underscores(PREFIX_UNDERSCORES)
  const suffix = underscores(ADDR_LENGTH - PREFIX_UNDERSCORES - libName.length)

  const libPlaceholder = `${prefix}${libName}${suffix}`

  const lib = await artifacts.require(libName).new()
  const libAddr = lib.address.replace('0x', '').toLowerCase()

  contract.bytecode = contract.bytecode.replace(new RegExp(libPlaceholder, 'g'), libAddr)
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
      await linkLib(artifact, 'Assert')

      deployed = await artifact.new()
    })

    mochaContext('> Solidity test', () => {
      artifact.abi.forEach(interface => {
        if (interface.type === 'function') {
          if (['beforeAll', 'beforeEach', 'afterEach', 'afterAll'].includes(interface.name)) {
            // Set up hooks
            global[HOOKS_MAP[interface.name]](() =>
              deployed[interface.name]()
                .then(receipt => processResult(receipt, false))
            )
          } else if (interface.name.startsWith('test')) {
            it(interface.name, () =>
              deployed[interface.name]()
                .then(receipt => processResult(receipt, true))
            )
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
