const { assertRevert } = require('./helpers/assertThrow')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const UpgradedKernel = artifacts.require('UpgradedKernel')
const DAOFactory = artifacts.require('DAOFactory')
const ACL = artifacts.require('ACL')
const getContract = artifacts.require

contract('Kernel Upgrade', accounts => {
    let kernelBase, factory, kernel, acl, namespace, kernelId = {}, app

    const permissionsRoot = accounts[0]

    before(async () => {
      kernelBase = await getContract('Kernel').new()
      const aclBase = await getContract('ACL').new()
      factory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x00')
    })

    beforeEach(async () => {
        const receipt = await factory.newDAO(permissionsRoot)
        app = receipt.logs.filter(l => l.event == 'DeployDAO')[0].args.dao

        kernel = Kernel.at(app)
        acl = ACL.at(await kernel.acl())

        const r = await kernel.APP_MANAGER_ROLE()

        namespace = await kernel.CORE_NAMESPACE()
        kernelId = await kernel.KERNEL_APP_ID()
    })

    it('checks ERC897 functions', async () => {
        const kernelProxy = KernelProxy.at(app)
        const implementation = await kernelProxy.implementation()
        assert.equal(implementation, kernelBase.address, "App address should match")
        const proxyType = (await kernelProxy.proxyType.call()).toString()
        assert.equal(proxyType, (await kernelProxy.UPGRADEABLE()).toString(), "Proxy type should be 2 (upgradeable)")
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
        const role = await kernel.APP_MANAGER_ROLE()
        await acl.createPermission(permissionsRoot, kernel.address, role, permissionsRoot, { from: permissionsRoot })

        const upgradedImpl = await UpgradedKernel.new()
        await kernel.setApp(namespace, kernelId, upgradedImpl.address)

        assert.isTrue(await UpgradedKernel.at(kernel.address).isUpgraded(), 'kernel should have been upgraded')
    })

    it('fails if upgrading to kernel that is not a contract', async () => {
        const role = await kernel.APP_MANAGER_ROLE()
        await acl.createPermission(permissionsRoot, kernel.address, role, permissionsRoot, { from: permissionsRoot })

        const upgradedImpl = await UpgradedKernel.new()

        return assertRevert(async () => {
            await kernel.setApp(namespace, kernelId, '0x1234')
        })
    })
})
