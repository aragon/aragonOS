const { hash } = require('eth-ens-namehash')
const { keccak_256 } = require('js-sha3')
const { assertRevert } = require('../../helpers/assertThrow')
const { getEventArgument } = require('../../helpers/events')

const ENS = artifacts.require('ENS')
const ENSFactory = artifacts.require('ENSFactory')
const PublicResolver = artifacts.require('PublicResolver')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const DAOFactory = artifacts.require('DAOFactory')

const APMRegistry = artifacts.require('APMRegistry')
const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')
const Repo = artifacts.require('Repo')
const APMRegistryFactory = artifacts.require('APMRegistryFactory')
const APMRegistryFactoryMock = artifacts.require('APMRegistryFactoryMock')

const EMPTY_BYTES = '0x'
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

contract('APMRegistry', ([ensOwner, apmOwner, repoDev, notOwner, someone]) => {
    let baseDeployed, baseAddrs, ensFactory, apmFactory, daoFactory, ens, registry, acl

    const rootNode = hash('aragonpm.eth')
    const testNode = hash('test.aragonpm.eth')

    before(async () => {
        const bases = [APMRegistry, Repo, ENSSubdomainRegistrar]
        baseDeployed = await Promise.all(bases.map(base => base.new()))
        baseAddrs = baseDeployed.map(c => c.address)

        ensFactory = await ENSFactory.new()

        const kernelBase = await Kernel.new(true) // petrify immediately
        const aclBase = await ACL.new()
        daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, ZERO_ADDR)
    })

    beforeEach(async () => {
        apmFactory = await APMRegistryFactory.new(daoFactory.address, ...baseAddrs, ZERO_ADDR, ensFactory.address)
        ens = ENS.at(await apmFactory.ens())

        const receipt = await apmFactory.newAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner)
        const apmAddr = getEventArgument(receipt, 'DeployAPM', 'apm')
        registry = APMRegistry.at(apmAddr)

        const dao = Kernel.at(await registry.kernel())
        acl = ACL.at(await dao.acl())
        const subdomainRegistrar = baseDeployed[2]

        // Get permission to delete names after each test case
        await acl.createPermission(apmOwner, await registry.registrar(), await subdomainRegistrar.DELETE_NAME_ROLE(), apmOwner, { from: apmOwner })
    })

    it('inits with existing ENS deployment', async () => {
        const receipt = await ensFactory.newENS(ensOwner)
        const ens2 = ENS.at(getEventArgument(receipt, 'DeployENS', 'ens'))
        const newFactory = await APMRegistryFactory.new(daoFactory.address, ...baseAddrs, ens2.address, ZERO_ADDR)

        await ens2.setSubnodeOwner(hash('eth'), '0x'+keccak_256('aragonpm'), newFactory.address)
        const receipt2 = await newFactory.newAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner)
        const apmAddr = getEventArgument(receipt2, 'DeployAPM', 'apm')
        const resolver = PublicResolver.at(await ens2.resolver(rootNode))

        assert.equal(await resolver.addr(rootNode), apmAddr, 'rootnode should be resolve')
    })

    it('aragonpm.eth should resolve to registry', async () => {
        const resolver = PublicResolver.at(await ens.resolver(rootNode))

        assert.equal(await resolver.addr(rootNode), registry.address, 'rootnode should be resolve')
    })

    it('aragonpm.eth should be owned by ENSSubdomainRegistrar', async () => {
        assert.equal(await ens.owner(rootNode), await registry.registrar(), 'rootnode should be owned correctly')
    })

    it('can create repo with version and dev can create new versions', async () => {
        const receipt = await registry.newRepoWithVersion('test', repoDev, [1, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: apmOwner })
        const repo = Repo.at(getEventArgument(receipt, 'NewRepo', 'repo'))

        assert.equal(await repo.getVersionsCount(), 1, 'should have created version')

        await repo.newVersion([2, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev })

        assert.equal(await repo.getVersionsCount(), 2, 'should have created version')
    })

    it('fails to init with existing ENS deployment if not owner of tld', async () => {
        const ensReceipt = await ensFactory.newENS(ensOwner)
        const ens2 = ENS.at(getEventArgument(ensReceipt, 'DeployENS', 'ens'))
        const newFactory = await APMRegistryFactory.new(daoFactory.address, ...baseAddrs, ens2.address, ZERO_ADDR)

        // Factory doesn't have ownership over 'eth' tld
        await assertRevert(newFactory.newAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner))
    })

    it('fails to create empty repo name', async () => {
        await assertRevert(registry.newRepo('', repoDev, { from: apmOwner }))
    })

    it('fails to create repo if not in ACL', async () => {
        await assertRevert(registry.newRepo('test', repoDev, { from: notOwner }))
    })

    context('> Creating test.aragonpm.eth repo', () => {
        let repo = {}

        beforeEach(async () => {
            const receipt = await registry.newRepo('test', repoDev, { from: apmOwner })
            repo = Repo.at(getEventArgument(receipt, 'NewRepo', 'repo'))
        })

        it('resolver is setup correctly', async () => {
            const resolverNode = hash('resolver.eth')
            const publicResolver = PublicResolver.at(await ens.resolver(resolverNode))

            assert.equal(await ens.resolver(testNode), await publicResolver.addr(resolverNode), 'resolver should be set to public resolver')
            assert.equal(await publicResolver.addr(testNode), repo.address, 'resolver should resolve to repo address')
        })

        it('repo should have 0 versions', async () => {
            assert.equal(await repo.getVersionsCount(), 0, 'shouldnt have created version')
        })

        it('fails when creating repo with existing name', async () => {
            await assertRevert(registry.newRepo('test', repoDev))
        })

        it('repo dev can create versions', async () => {
            await repo.newVersion([1, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev })
            await repo.newVersion([2, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev })

            assert.equal(await repo.getVersionsCount(), 2, 'should have created versions')
        })

        it('repo dev can authorize someone to interact with repo', async () => {
            await repo.newVersion([1, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev })
            const newOwner = someone

            await acl.grantPermission(newOwner, repo.address, await repo.CREATE_VERSION_ROLE(), { from: repoDev })

            await repo.newVersion([2, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: newOwner })
            await repo.newVersion([2, 1, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev }) // repoDev can still create them

            assert.equal(await repo.getVersionsCount(), 3, 'should have created versions')
        })

        it('repo dev can no longer create versions if permission is removed', async () => {
            await repo.newVersion([1, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev })
            await acl.revokePermission(repoDev, repo.address, await repo.CREATE_VERSION_ROLE(), { from: repoDev })

            await assertRevert(repo.newVersion([2, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: repoDev }))
        })

        it('cannot create versions if not in ACL', async () => {
            await assertRevert(repo.newVersion([1, 0, 0], ZERO_ADDR, EMPTY_BYTES, { from: notOwner }))
        })
    })

    context('> Created with missing permissions', () => {
        let apmFactoryMock

        before(async () => {
            apmFactoryMock = await APMRegistryFactoryMock.new(daoFactory.address, ...baseAddrs, ensFactory.address)
        })

        it('fails if factory doesnt give permission to create names', async () => {
            await assertRevert(apmFactoryMock.newFailingAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner, true))
        })

        it('fails if factory doesnt give permission to create permissions', async () => {
            await assertRevert(apmFactoryMock.newFailingAPM(hash('eth'), '0x'+keccak_256('aragonpm'), apmOwner, false))
        })
    })
})
