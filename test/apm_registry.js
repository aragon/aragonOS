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
    let ens, apmFactory, registry, baseDeployed = {}
    const ensOwner = accounts[0]
    const apmOwner = accounts[1]
    const notOwner = accounts[5]

    const rootNode = namehash('aragonpm.eth')
    const testName = namehash('test.aragonpm.eth')

    before(async () => {
        const bases = ['APMRegistry', 'Repo', 'ENSSubdomainRegistrar']
        baseDeployed = await Promise.all(bases.map(c => getContract(c).new()))
        const baseAddrs = baseDeployed.map(c => c.address)

        const ensFactory = await getContract('ENSFactory').new()
        apmFactory = await getContract('APMRegistryFactory').new(...baseAddrs, '0x0', ensFactory.address, { gas: 6e6 })
        ens = ENS.at(await apmFactory.ens())
    })

    beforeEach(async () => {
        const receipt = await apmFactory.newAPM(namehash('eth'), '0x'+keccak256('aragonpm'), apmOwner)
        const apmAddr = receipt.logs.filter(l => l.event == 'DeployAPM')[0].args.apm
        registry = APMRegistry.at(apmAddr)

        const kernel = Kernel.at(await registry.kernel())
        const subdomainRegistrar = baseDeployed[2]

        // Get permission to delete names after each test case
        await kernel.createPermission(apmOwner, await registry.registrar(), await subdomainRegistrar.DELETE_NAME_ROLE(), apmOwner, { from: apmOwner })
    })

    afterEach(async () => {
        // Clean up test.aragonpm.eth if was set
        const zeroAddr = '0x0000000000000000000000000000000000000000'
        if (await ens.owner(testName) == zeroAddr) return

        // Free test name so it can be used on next test
        const registrar = getContract('ENSSubdomainRegistrar').at(await registry.registrar())
        await registrar.deleteName('0x'+keccak256('test'), { from: apmOwner })
        assert.equal(await ens.owner(testName), zeroAddr, 'should have cleaned up')
    })


    it('aragonpm.eth should resolve to registry', async () => {
        const resolver = PublicResolver.at(await ens.resolver(rootNode))

        assert.equal(await resolver.addr(rootNode), registry.address, 'rootnode should be resolve')
    })

    it('aragonpm.eth should be owned by ENSSubdomainRegistrar', async () => {
        assert.equal(await ens.owner(rootNode), await registry.registrar(), 'rootnode should be owned correctly')
    })

    const getRepoFromLog = receipt => receipt.logs.filter(x => x.event == 'NewRepo')[0].args.repo

    context('creating test.aragonpm.eth repo', () => {
        let repo = {}

        beforeEach(async () => {
            const receipt = await registry.newRepo('test', { from: apmOwner })
            repo = Repo.at(getRepoFromLog(receipt))
        })

        it('resolver is setup correctly', async () => {
            const resolverNode = namehash('resolver.eth')
            const publicResolver = PublicResolver.at(await ens.resolver(resolverNode))

            assert.equal(await ens.resolver(testName), await publicResolver.addr(resolverNode), 'resolver should be set to public resolver')
            assert.equal(await publicResolver.addr(testName), repo.address, 'resolver should resolve to repo address')
        })

        it('is owned by registry', async () => {
            assert.equal(await repo.owner(), registry.address, 'repo owner should be correct')
        })

        it('repo should have 0 versions', async () => {
            assert.equal(await repo.getVersionsCount(), 0, 'shouldnt have crated version')
        })

        it('fails when creating repo with existing name', async () => {
            return assertRevert(async () => {
                await registry.newRepo('test')
            })
        })

        it('can create versions through registry', async () => {
            await registry.newVersion(repo.address, [1, 0, 0], '0x00', '0x00', { from: apmOwner })
            await registry.newVersion(repo.address, [2, 0, 0], '0x00', '0x00', { from: apmOwner })

            assert.equal(await repo.getVersionsCount(), 2, 'should have created versions')
        })

        it('can free repo and interact directly', async () => {
            registry.newVersion(repo.address, [1, 0, 0], '0x00', '0x00', { from: apmOwner })
            const newOwner = accounts[8]
            await registry.freeRepo(repo.address, newOwner, { from: apmOwner })
            await repo.newVersion([2, 0, 0], '0x00', '0x00', { from: newOwner })

            assert.equal(await repo.getVersionsCount(), 2, 'should have created versions')
        })

        it('cannot create versions if not in ACL', async () => {
            return assertRevert(async () => {
                await registry.newVersion(repo.address, [1, 0, 0], '0x00', '0x00', { from: notOwner })
            })
        })

        it('cannot free repo if not in ACL', async () => {
            return assertRevert(async () => {
                await registry.freeRepo(repo.address, '0x12', { from: notOwner })
            })
        })

        it('cant interact directly with a repo not freed', async () => {
            return assertRevert(async () => {
                await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: apmOwner })
            })
        })

        it('cant interact through registry after freed', async () => {
            await registry.freeRepo(repo.address, '0x12', { from: apmOwner })
            return assertRevert(async () => {
                await registry.newVersion(repo.address, [1, 0, 0], '0x00', '0x00', { from: apmOwner })
            })
        })
    })

    it('can create repo with version', async () => {
        const receipt = await registry.newRepoWithVersion('test', [1, 0, 0], '0x00', '0x00', { from: apmOwner })
        const repoAddr = getRepoFromLog(receipt)

        assert.equal(await Repo.at(repoAddr).getVersionsCount(), 1, 'should have crated version')
    })

    it('cannot create repo if not in ACL', async () => {
        return assertRevert(async () => {
            await registry.newRepo('test', { from: notOwner })
        })
    })

    it('can create and free repo', async () => {
        const newOwner = accounts[8]
        const receipt = await registry.newFreeRepo('test', newOwner, { from: apmOwner })
        const repo = Repo.at(getRepoFromLog(receipt))

        await repo.newVersion([1, 0, 0], '0x00', '0x00', { from: newOwner })
        assert.equal(await repo.getVersionsCount(), 1, 'should have created version')
    })
})
