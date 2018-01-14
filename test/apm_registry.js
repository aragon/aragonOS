const { assertRevert } = require('./helpers/assertThrow')
const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const ENS = artifacts.require('ENS')
const Repo = artifacts.require('Repo')
const APMRegistry = artifacts.require('APMRegistry')
const PublicResolver = artifacts.require('PublicResolver')
const Kernel = artifacts.require('Kernel')

const getContract = name => artifacts.require(name)

contract('APMRegistry', accounts => {
    let ens, apmFactory, registry, baseDeployed, dao = {}
    const ensOwner = accounts[0]
    const apmOwner = accounts[1]
    const repoDev  = accounts[2]
    const notOwner = accounts[5]

    const rootNode = namehash('aragonpm.eth')
    const testNode = namehash('test.aragonpm.eth')

    before(async () => {
        const bases = ['APMRegistry', 'Repo', 'ENSSubdomainRegistrar']
        baseDeployed = await Promise.all(bases.map(c => getContract(c).new()))
        const baseAddrs = baseDeployed.map(c => c.address)

        const ensFactory = await getContract('ENSFactory').new()
        apmFactory = await getContract('APMRegistryFactory').new(...baseAddrs, '0x0', ensFactory.address)
        ens = ENS.at(await apmFactory.ens())
    })

    beforeEach(async () => {
        const receipt = await apmFactory.newAPM(namehash('eth'), '0x'+keccak256('aragonpm'), apmOwner)
        const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
        registry = APMRegistry.at(apmAddr)

        dao = Kernel.at(await registry.kernel())
        const subdomainRegistrar = baseDeployed[2]

        // Get permission to delete names after each test case
        await dao.createPermission(apmOwner, await registry.registrar(), await subdomainRegistrar.DELETE_NAME_ROLE(), apmOwner, { from: apmOwner })
    })

    afterEach(async () => {
        // Clean up test.aragonpm.eth if was set
        const zeroAddr = '0x0000000000000000000000000000000000000000'
        if (await ens.owner(testNode) == zeroAddr) return

        // Free test name so it can be used on next test
        const registrar = getContract('ENSSubdomainRegistrar').at(await registry.registrar())
        await registrar.deleteName('0x'+keccak256('test'), { from: apmOwner })
        assert.equal(await ens.owner(testNode), zeroAddr, 'should have cleaned up')
    })

    it('aragonpm.eth should resolve to registry', async () => {
        const resolver = PublicResolver.at(await ens.resolver(rootNode))

        assert.equal(await resolver.addr(rootNode), registry.address, 'rootnode should be resolve')
    })

    it('aragonpm.eth should be owned by ENSSubdomainRegistrar', async () => {
        assert.equal(await ens.owner(rootNode), await registry.registrar(), 'rootnode should be owned correctly')
    })

    it('fails to create empty repo name', async () => {
        return assertRevert(async () => {
            await registry.newRepo('', repoDev, { from: apmOwner })
        })
    })

    const getRepoFromLog = receipt => receipt.logs.filter(x => x.event == 'NewRepo')[0].args.repo

    context('creating test.aragonpm.eth repo', () => {
        let repo = {}

        beforeEach(async () => {
            const receipt = await registry.newRepo('test', repoDev, { from: apmOwner })
            repo = Repo.at(getRepoFromLog(receipt))
        })

        it('resolver is setup correctly', async () => {
            const resolverNode = namehash('resolver.eth')
            const publicResolver = PublicResolver.at(await ens.resolver(resolverNode))

            assert.equal(await ens.resolver(testNode), await publicResolver.addr(resolverNode), 'resolver should be set to public resolver')
            assert.equal(await publicResolver.addr(testNode), repo.address, 'resolver should resolve to repo address')
        })

        it('repo should have 0 versions', async () => {
            assert.equal(await repo.getVersionsCount(), 0, 'shouldnt have created version')
        })

        it('fails when creating repo with existing name', async () => {
            return assertRevert(async () => {
                await registry.newRepo('test', repoDev)
            })
        })

        it('repo dev can create versions', async () => {
            await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: repoDev })
            await repo.newVersion([2, 0, 0], '0x00', '0x00', { from: repoDev })

            assert.equal(await repo.getVersionsCount(), 2, 'should have created versions')
        })

        it('repo dev can authorize someone to interact with repo', async () => {
            await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: repoDev })
            const newOwner = accounts[8]

            await dao.grantPermission(newOwner, repo.address, await repo.CREATE_VERSION_ROLE(), { from: repoDev })

            await repo.newVersion([2, 0, 0], '0x00', '0x00', { from: newOwner })
            await repo.newVersion([2, 1, 0], '0x00', '0x00', { from: repoDev }) // repoDev can still create them

            assert.equal(await repo.getVersionsCount(), 3, 'should have created versions')
        })

        it('repo dev can no longer create versions if permission is removed', async () => {
            await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: repoDev })
            await dao.revokePermission(repoDev, repo.address, await repo.CREATE_VERSION_ROLE(), { from: repoDev })

            return assertRevert(async () => {
                await repo.newVersion([2, 0, 0], '0x00', '0x00', { from: repoDev })
            })
        })

        it('cannot create versions if not in ACL', async () => {
            return assertRevert(async () => {
                await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: notOwner })
            })
        })
    })

    it('can create repo with version', async () => {
        const receipt = await registry.newRepoWithVersion('test', repoDev, [1, 0, 0], '0x00', '0x00', { from: apmOwner })
        const repoAddr = getRepoFromLog(receipt)

        assert.equal(await Repo.at(repoAddr).getVersionsCount(), 1, 'should have created version')
    })

    it('cannot create repo if not in ACL', async () => {
        return assertRevert(async () => {
            await registry.newRepo('test', repoDev, { from: notOwner })
        })
    })
})
