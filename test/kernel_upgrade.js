const { assertInvalidOpcode } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const UpgradedKernel = artifacts.require('UpgradedKernel')
const { getBlockNumber } = require('./helpers/web3')

const getSig = x => web3.sha3(x).slice(0, 10)

contract('Kernel Upgrade', accounts => {
    let kernel = {}

    const permissionsRoot = accounts[0]

    beforeEach(async () => {
        const kernelImpl = await Kernel.new()
        const kernelProxy = await KernelProxy.new(kernelImpl.address)
        kernel = Kernel.at(kernelProxy.address)
        await kernel.initialize(permissionsRoot)
    })

    it('fails to upgrade kernel without permission', async () => {
        return assertInvalidOpcode(async () => {
            await kernel.upgradeKernel(accounts[0])
        })
    })

    it('fails when calling is upgraded on old version', async () => {
        return assertInvalidOpcode(async () => {
            await UpgradedKernel.at(kernel.address).isUpgraded()
        })
    })

    it('successfully upgrades kernel', async () => {
        const role = await kernel.UPGRADE_KERNEL_ROLE()
        await kernel.createPermission(permissionsRoot, kernel.address, role, permissionsRoot)

        const upgradedImpl = await UpgradedKernel.new()
        await kernel.upgradeKernel(upgradedImpl.address)

        assert.isTrue(await UpgradedKernel.at(kernel.address).isUpgraded(), 'kernel should have been upgraded')
    })
})
