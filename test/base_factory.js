const { assertInvalidOpcode } = require('./helpers/assertThrow')
const BaseFactory = artifacts.require('BaseFactory')

contract('BaseFactory', accounts => {
    let factory = {}

    before(async () => {
        // relies on Factory deployed in migrations
        factory = await BaseFactory.deployed()
    })
    it('deploys DAO', async () => {
        const receipt = await factory.deploy('Test organization', 'T$T')
        const logs = receipt.logs.filter(log => log.event == 'DAODeploy')
        assert.equal(logs.length, 1, 'should have emited deploy DAO event')
    })
})
