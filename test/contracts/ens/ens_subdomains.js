const { hash } = require('eth-ens-namehash')
const { keccak_256 } = require('js-sha3')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument } = require('../../helpers/events')

const ENS = artifacts.require('ENS')
const ENSFactory = artifacts.require('ENSFactory')

const Repo = artifacts.require('Repo')
const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const DAOFactory = artifacts.require('DAOFactory')
const APMRegistry = artifacts.require('APMRegistry')
const APMRegistryFactory = artifacts.require('APMRegistryFactory')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')

const EMPTY_BYTES = '0x'
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

// Using APMFactory in order to reuse it
contract('ENSSubdomainRegistrar', ([_, apmOwner, notOwner]) => {
    let baseDeployed, apmFactory, ensFactory, dao, daoFactory, ens, registrar
    let APP_BASES_NAMESPACE

    const holanode = hash('hola.aragonpm.eth')
    const holalabel = '0x'+keccak_256('hola')

    before(async () => {
        const bases = [APMRegistry, Repo, ENSSubdomainRegistrar]
        baseDeployed = await Promise.all(bases.map(base => base.new()))

        ensFactory = await ENSFactory.new()

        const kernelBase = await Kernel.new(true) // petrify immediately
        const aclBase = await ACL.new()
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR)

        APP_BASES_NAMESPACE = await kernelBase.APP_BASES_NAMESPACE()
    })

    beforeEach(async () => {
        const baseAddrs = baseDeployed.map(c => c.address)
        apmFactory = await APMRegistryFactory.new(daoFactory.address, ...baseAddrs, ZERO_ADDR, ensFactory.address)
        ens = ENS.at(await apmFactory.ens())

        const receipt = await apmFactory.newAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner)
        const apmAddr = getEventArgument(receipt, 'DeployAPM', 'apm')
        const registry = APMRegistry.at(apmAddr)

        dao = Kernel.at(await registry.kernel())
        const acl = ACL.at(await dao.acl())

        registrar = ENSSubdomainRegistrar.at(await registry.registrar())
        const subdomainRegistrar = baseDeployed[2]

        await acl.grantPermission(apmOwner, await registry.registrar(), await subdomainRegistrar.CREATE_NAME_ROLE(), { from: apmOwner })
        await acl.createPermission(apmOwner, await registry.registrar(), await subdomainRegistrar.DELETE_NAME_ROLE(), apmOwner, { from: apmOwner })
    })

    it('can create name', async () => {
        await registrar.createName(holalabel, apmOwner, { from: apmOwner })

        assert.equal(await ens.owner(hash('hola.aragonpm.eth')), apmOwner, 'should have created name')
    })

    it('fails if creating names twice', async () => {
        await registrar.createName(holalabel, apmOwner, { from: apmOwner })
        await assertRevert(registrar.createName(holalabel, apmOwner, { from: apmOwner }))
    })

    it('fails if deleting name not yet created', async () => {
        await assertRevert(registrar.deleteName(holalabel, { from: apmOwner }))
    })

    it('fails if not authorized to create name', async () => {
        await assertRevert(registrar.createName(holalabel, apmOwner, { from: notOwner }))
    })

    it('can delete names', async () => {
        await registrar.createName(holalabel, apmOwner, { from: apmOwner })
        await registrar.deleteName(holalabel, { from: apmOwner })

        assert.equal(await ens.owner(holanode), ZERO_ADDR, 'should have reset name')
    })

    it('can delete names registered to itself', async () => {
        await registrar.createName(holalabel, registrar.address, { from: apmOwner })
        await registrar.deleteName(holalabel, { from: apmOwner })

        assert.equal(await ens.owner(holanode), ZERO_ADDR, 'should have reset name')
    })

    it('fails if initializing without rootnode ownership', async () => {
        const ens = await ENS.new()
        const newRegProxy = await AppProxyUpgradeable.new(dao.address, hash('apm-enssub.aragonpm.eth'), EMPTY_BYTES)
        const newReg = ENSSubdomainRegistrar.at(newRegProxy.address)

        await assertRevert(newReg.initialize(ens.address, holanode))
    })
})
