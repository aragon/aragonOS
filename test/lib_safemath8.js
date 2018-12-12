const { assertRevert } = require('./helpers/assertThrow')

contract('SafeMath8 lib test', accounts => {
  let safeMath8Mock

  before(async () => {
    safeMath8Mock = await artifacts.require('SafeMath8Mock').new()
  })

  // multiplication
  it('multiplies', async () => {
    const a = 16
    const b = 15
    assert.equal((await safeMath8Mock.mulExt(a, b)).toString(), a * b, "Values should match")
  })

  it('fails if multplication overflows', async () => {
    const a = 16
    const b = 16
    return assertRevert(async () => {
      await safeMath8Mock.mulExt(a, b)
    })
  })

  // division
  it('divides', async () => {
    const a = 149
    const b = 50
    assert.equal((await safeMath8Mock.divExt(a, b)).toString(), Math.floor(a / b), "Values should match")
  })

  it('fails dividing by zero', async () => {
    const a = 123
    const b = 0
    return assertRevert(async () => {
      await safeMath8Mock.divExt(a, b)
    })
  })

  // subtraction
  it('subtract', async () => {
    const a = 123
    const b = 122
    assert.equal((await safeMath8Mock.subExt(a, b)).toString(), a - b, "Values should match")
  })

  it('fails if subtraction underflows', async () => {
    const a = 123
    const b = 124
    return assertRevert(async () => {
      await safeMath8Mock.subExt(a, b)
    })
  })

  // addition
  it('adds', async () => {
    const a = 128
    const b = 127
    assert.equal((await safeMath8Mock.addExt(a, b)).toString(), a + b, "Values should match")
  })

  it('fails if addition overflows', async () => {
    const a = 128
    const b = 128
    return assertRevert(async () => {
      await safeMath8Mock.addExt(a, b)
    })
  })

  // modulo
  it('divides modulo', async () => {
    const a = 149
    const b = 50
    assert.equal((await safeMath8Mock.modExt(a, b)).toString(), a % b, "Values should match")
  })

  it('fails modulo dividing by zero', async () => {
    const a = 123
    const b = 0
    return assertRevert(async () => {
      await safeMath8Mock.modExt(a, b)
    })
  })
})
