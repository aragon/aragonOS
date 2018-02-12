const { assertRevert } = require('./helpers/assertThrow')

const Repo = artifacts.require('Repo')
const getContract = artifacts.require

contract('Repo', accounts => {
    let repo = {}

    beforeEach(async () => {
        repo = await Repo.new()
    })

    it('computes correct valid bumps', async () => {
        await assert.isTrue(await repo.isValidBump.call([0, 0, 0], [0, 0, 1]))
        await assert.isTrue(await repo.isValidBump.call([0, 0, 0], [0, 1, 0]))
        await assert.isTrue(await repo.isValidBump.call([0, 0, 0], [1, 0, 0]))
        await assert.isTrue(await repo.isValidBump.call([1, 4, 7], [2, 0, 0]))
        await assert.isTrue(await repo.isValidBump.call([147, 4, 7], [147, 5, 0]))

        await assert.isFalse(await repo.isValidBump.call([0, 0, 1], [0, 0, 1]))
        await assert.isFalse(await repo.isValidBump.call([0, 1, 0], [0, 2, 1]))
        await assert.isFalse(await repo.isValidBump.call([0, 0, 2], [0, 0, 1]))
        await assert.isFalse(await repo.isValidBump.call([2, 1, 0], [2, 2, 1]))
        await assert.isFalse(await repo.isValidBump.call([1, 1, 1], [5, 0, 0]))
        await assert.isFalse(await repo.isValidBump.call([5, 0, 0], [5, 2, 0]))
        await assert.isFalse(await repo.isValidBump.call([0, 1, 2], [1, 1, 2]))
        await assert.isFalse(await repo.isValidBump.call([0, 0, Math.pow(2, 16)], [0, 0, Math.pow(2, 16) - 1]))
    })

    // valid version as being a correct bump from 0.0.0
    it('cannot create invalid first version', async () => {
        return assertRevert(async () => {
            await repo.newVersion([1, 1, 0], '0x00', '0x00')
        })
    })

    context('creating initial version', () => {
        const initialCode = accounts[8] // random addr, irrelevant
        const initialContent = '0x12'

        beforeEach(async () => {
            await repo.newVersion([1, 0, 0], initialCode, initialContent)
        })

        const assertVersion = (versionData, semanticVersion, code, contentUri) => {
            const [[maj, min, pat], addr, content] = versionData

            assert.equal(maj, semanticVersion[0], 'major should match')
            assert.equal(min, semanticVersion[1], 'minor should match')
            assert.equal(pat, semanticVersion[2], 'patch should match')

            assert.equal(addr, code, 'code should match')
            assert.equal(content, contentUri, 'content should match')
        }

        it('version is fetchable as latest', async () => {
            assertVersion(await repo.getLatest(), [1, 0, 0], initialCode, initialContent)
        })

        it('version is fetchable by semantic version', async () => {
            assertVersion(await repo.getBySemanticVersion([1, 0, 0]), [1, 0, 0], initialCode, initialContent)
        })

        it('version is fetchable by contract address', async () => {
            assertVersion(await repo.getLatestForContractAddress(initialCode), [1, 0, 0], initialCode, initialContent)
        })

        it('version is fetchable by version id', async () => {
            assertVersion(await repo.getByVersionId(1), [1, 0, 0], initialCode, initialContent)
        })

        it('setting contract address to 0 reuses last version address', async () => {
            await repo.newVersion([1, 1, 0], '0x00', initialContent)
            assertVersion(await repo.getByVersionId(2), [1, 1, 0], initialCode, initialContent)
        })

        it('fails when changing contract address in non major version', async () => {
            return assertRevert(async () => {
                await repo.newVersion([1, 1, 0], accounts[2], initialContent)
            })
        })

        it('fails when version bump is invalid', async () => {
            return assertRevert(async () => {
                await repo.newVersion([1, 2, 0], initialCode, initialContent)
            })
        })

        it('fails if requesting version 0', async () => {
            return assertRevert(async () => {
                await repo.getByVersionId(0)
            })
        })

        context('adding new version', async () => {
            const newCode = accounts[9] // random addr, irrelevant
            const newContent = '0x13'

            beforeEach(async () => {
                await repo.newVersion([2, 0, 0], newCode, newContent)
            })

            it('new version is fetchable as latest', async () => {
                assertVersion(await repo.getLatest(), [2, 0, 0], newCode, newContent)
            })

            it('new version is fetchable by semantic version', async () => {
                assertVersion(await repo.getBySemanticVersion([2, 0, 0]), [2, 0, 0], newCode, newContent)
            })

            it('new version is fetchable by contract address', async () => {
                assertVersion(await repo.getLatestForContractAddress(newCode), [2, 0, 0], newCode, newContent)
            })

            it('new version is fetchable by version id', async () => {
                assertVersion(await repo.getByVersionId(2), [2, 0, 0], newCode, newContent)
            })

            it('old version is fetchable by semantic version', async () => {
                assertVersion(await repo.getBySemanticVersion([1, 0, 0]), [1, 0, 0], initialCode, initialContent)
            })

            it('old version is fetchable by contract address', async () => {
                assertVersion(await repo.getLatestForContractAddress(initialCode), [1, 0, 0], initialCode, initialContent)
            })

            it('old version is fetchable by version id', async () => {
                assertVersion(await repo.getByVersionId(1), [1, 0, 0], initialCode, initialContent)
            })
        })
    })
})
