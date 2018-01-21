const { rawEncode } = require('ethereumjs-abi')
const { toBuffer } = require('ethereumjs-util')
const ScriptHelpers = artifacts.require('ScriptHelpers')
const EncodeMock = artifacts.require('EncodeMock')


contract('EVM Script: ABI encoder', accounts => {
    let helper = {}

    const testCase = [
        ['0x1231', '0x575775', []],
        ['0x', '0x', []],
        ['0x1231123112311231123112311231', '0x12311231123118383883', ['0x12', '0x34']],
        ['0x', '0x', ['0x12', '0x34', '0x56', '0x57']],
        ['0x', '0x12', ['0x12', '0x34', '0x56', '0x57']],
        ['0x12', '0x00', ['0x12', '0x34', '0x56', '0x57']],
        ['he he heyyyyy', 'wasa wasa wasaaaa', ['0x000000000000000000000000000000e000000000', '0xaaaab0000000000000000000000000e000000000']],
    ]

    before(async () => {
        helper = await ScriptHelpers.new()
    })

    context('against web3 encoding', () => {
        testCase.forEach(async (t, i) => {
            it(`test: ${i + 1}`, async () => {
                const a = await helper.abiEncode.call(...t)
                const curatedT = t.map(to => to.indexOf('0x') != 0 ? to : toBuffer(to))
                const b = '0x' + rawEncode(['bytes', 'bytes', 'address[]'], curatedT).toString('hex')
                assert.equal(a, b, 'encoders should match')
            })
        })
    })

    context('against solc encoding', () => {
        let tester = {}
        before(async () => {
            tester = await EncodeMock.new()
        })

        testCase.forEach(async (t, i) => {
            it(`test: ${i + 1}`, async () => {
                const a = await helper.abiEncode.call(...t)
                const curatedT = t.map(to => to.indexOf('0x') != 0 ? to : toBuffer(to))
                await tester.exec(...t)
                const result = await tester.result()
                const b = "0x" + result.slice(10) // remove signature
                assert.equal(a, b, 'encoders should match')
            })
        })
    })
})
