const { assertRevert } = require('./helpers/assertThrow')
const namehash = require('eth-ens-namehash').hash

const ENS = artifacts.require('ENS')
const RepoRegistry = artifacts.require('RepoRegistry')
const AddrResolver = artifacts.require('AddrResolver')
const Repo = artifacts.require('Repo')
const ForwarderFactory = artifacts.require('ForwarderFactory')

contract('Repo Registry', accounts => {
    let ens, registry = {}

    const ensOwner = accounts[0]

    const rootNode = namehash('aragonpm.test')

    before(async () => {
        // Migration deployed ENS
        ens = await ENS.deployed()

        // request rootnode from migrations repo registry
        await RepoRegistry.at(RepoRegistry.address).setRootOwner(ensOwner)
    })

    beforeEach(async () => {
        registry = await RepoRegistry.new(ens.address, rootNode, ForwarderFactory.address)
        await ens.setOwner(rootNode, registry.address)
        await registry.setResolver()
    })

    afterEach(async () => {
        await registry.setRootOwner(ensOwner) // transfer name ownership back
    })

    it('registry should be name owner for aragonpm.test', async () => {
        assert.equal(await ens.owner(rootNode), registry.address, 'should be owner')
    })

    it('can transfer ownership', async () => {
        await registry.transferOwnership(accounts[1])
        assert.equal(await registry.owner(), accounts[1], 'owner should have changed correctly')

        await registry.transferOwnership(accounts[0], { from: accounts[1] }) // so afterEach hook doesnt break
    })

    it('fails when non-owner tries to set root owner', async () => {
        return assertRevert(async () => {
            await registry.transferOwnership(accounts[1], { from: accounts[2] })
        })
    })

    it('registry rootnode should resolve to registry address', async () => {
        const resolver = await ens.resolver(rootNode)
        const addr = await AddrResolver.at(resolver).addr(rootNode)

        assert.equal(addr, registry.address, 'name should have resolved to registry address')
    })

    let repoAddr = {}
    context('creating test.aragonpm.test repo', () => {
        const repoOwner = accounts[1]

        const testName = namehash('test.aragonpm.test')

        beforeEach(async () => {
            const receipt = await registry.newRepo('test', { from: repoOwner })
            repoAddr = receipt.logs.filter(x => x.event == 'NewRepo')[0].args.repo
        })

        it('resolver is setup correctly', async () => {
            assert.equal(await ens.resolver(testName), registry.address, 'resolver should be set to registry')
            assert.equal(await AddrResolver.at(registry.address).addr(testName), repoAddr, 'resolver should resolve to repo address')
        })

        it('is owned by creator', async () => {
            assert.equal(await Repo.at(repoAddr).owner(), repoOwner, 'repo owner should be correct')
        })

        it('repo should have 0 versions', async () => {
            assert.equal(await Repo.at(repoAddr).getVersionsCount(), 0, 'shouldnt have crated version')
        })

        it('fails when creating repo with existing name', async () => {
            return assertRevert(async () => {
                await registry.newRepo('test')
            })
        })
    })

    it('can create repo with version', async () => {
        const receipt = await registry.newRepoWithVersion('test', [1, 0, 0], '0x00', '0x00')
        repoAddr = receipt.logs.filter(x => x.event == 'NewRepo')[0].args.repo

        assert.equal(await Repo.at(repoAddr).getVersionsCount(), 1, 'should have crated version')
    })
})
