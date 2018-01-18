const { rawEncode } = require('ethereumjs-abi')
const { toBuffer } = require('ethereumjs-util')
const ScriptHelpers = artifacts.require('ScriptHelpers')

contract('EVM Script: ABI encoder', accounts => {
    let helper = {}

    // TODO: Fix cases
    const testCase = [
        ['0x1231', '0x575775', []],
        ['0x', '0x', []],
        ['0x1231123112311231123112311231', '0x12311231123118383883', ['0x12', '0x34']],
        ['0x', '0x', ['0x12', '0x34', '0x56', '0x57']]
    ]

    before(async () => {
        helper = await ScriptHelpers.new()
    })

    testCase.forEach(async (t, i) => {
        it(`test encoding: ${i + 1}`, async () => {
            const a = await helper.abiEncode(...t)
            const curatedT = t.map(to => to.indexOf('0x') != 0 ? to : toBuffer(to))
            const b = '0x' + rawEncode(['bytes', 'bytes', 'address[]'], curatedT).toString('hex')
            assert.equal(a, b, 'encoders should match')
        })
    })
})
