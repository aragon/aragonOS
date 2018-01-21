const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const UpgradedKernel = artifacts.require('UpgradedKernel')
const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')

contract('Kernel Upgrade', accounts => {
    let kernel, namespace, kernelId = {}

    const permissionsRoot = accounts[0]

    before(async () => {
        factory = await DAOFactory.new()
    })

    beforeEach(async () => {
        const receipt = await factory.newDAO(permissionsRoot)
        app = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

        kernel = Kernel.at(app)
        acl = ACL.at(await kernel.acl())

        const r = await kernel.APP_MANAGER()

        namespace = await kernel.CORE_NAMESPACE()
        kernelId = await kernel.KERNEL_APP_ID()
    })

    it('fails to upgrade kernel without permission', async () => {
        return assertRevert(async () => {
            await kernel.setApp(namespace, kernelId, accounts[0])
        })
    })

    it('fails when calling is upgraded on old version', async () => {
        return assertRevert(async () => {
            await UpgradedKernel.at(kernel.address).isUpgraded()
        })
    })

    it('successfully upgrades kernel', async () => {
        const role = await kernel.APP_MANAGER()
        await acl.createPermission(permissionsRoot, kernel.address, role, permissionsRoot, { from: permissionsRoot })

        const upgradedImpl = await UpgradedKernel.new()
        await kernel.setApp(namespace, kernelId, upgradedImpl.address)

        assert.isTrue(await UpgradedKernel.at(kernel.address).isUpgraded(), 'kernel should have been upgraded')
    })
})
