const { ZERO_ADDRESS } = require('@aragon/contract-helpers-test')
const { assertEvent, assertRevert } = require('@aragon/contract-helpers-test/src/asserts')

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const UpgradedKernel = artifacts.require('UpgradedKernel')

// Mocks
const ERCProxyMock = artifacts.require('ERCProxyMock')

// Only applicable to KernelProxy instances
contract('Kernel upgrade', ([permissionsRoot, someone]) => {
    let aclBase, kernelBase, upgradedBase, kernelAddr, kernel, acl
    let APP_MANAGER_ROLE, CORE_NAMESPACE, KERNEL_APP_ID, UPGRADEABLE

    before(async () => {
        kernelBase = await Kernel.new(true) // petrify immediately
        upgradedBase = await UpgradedKernel.new(true) // petrify immediately

        aclBase = await ACL.new()

        // Setup constants
        APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
        CORE_NAMESPACE = await kernelBase.CORE_NAMESPACE()
        KERNEL_APP_ID = await kernelBase.KERNEL_APP_ID()

        const ercProxyMock = await ERCProxyMock.new()
        UPGRADEABLE = (await ercProxyMock.UPGRADEABLE()).toString()
    })

    beforeEach(async () => {
        kernel = await Kernel.at((await KernelProxy.new(kernelBase.address)).address)
        await kernel.initialize(aclBase.address, permissionsRoot)
        acl = await ACL.at(await kernel.acl())
        kernelAddr = kernel.address
    })

    it('checks ERC897 functions', async () => {
        const kernelProxy = await KernelProxy.at(kernelAddr)
        const implementation = await kernelProxy.implementation()
        assert.equal(implementation, kernelBase.address, "App address should match")
        const proxyType = (await kernelProxy.proxyType()).toString()
        assert.equal(proxyType, UPGRADEABLE, "Proxy type should be 2 (upgradeable)")
    })

    it('emits SetApp event', async () => {
        const kernelProxy = await KernelProxy.new(kernelBase.address)
        const { logs } = await web3.eth.getTransactionReceipt(kernelProxy.transactionHash)

        assertEvent({ rawLogs: logs }, 'SetApp', { decodeForAbi: KernelProxy.abi, expectedArgs: { namespace: CORE_NAMESPACE, appId: KERNEL_APP_ID, app: kernelBase.address } })
    })

    it('fails to create a KernelProxy if the base is 0', async () => {
        await assertRevert(KernelProxy.new(ZERO_ADDRESS))
    })

    it('fails to create a KernelProxy if the base is not a contract', async () => {
        await assertRevert(KernelProxy.new(someone))
    })

    it('fails to upgrade kernel without permission', async () => {
        await assertRevert(kernel.setApp(CORE_NAMESPACE, KERNEL_APP_ID, permissionsRoot))
    })

    it('fails when calling upgraded functionality on old version', async () => {
        await assertRevert((await UpgradedKernel.at(kernelAddr)).isUpgraded())
    })

    it('successfully upgrades kernel', async () => {
        await acl.createPermission(permissionsRoot, kernelAddr, APP_MANAGER_ROLE, permissionsRoot, { from: permissionsRoot })

        await kernel.setApp(CORE_NAMESPACE, KERNEL_APP_ID, upgradedBase.address)

        assert.isTrue(await (await UpgradedKernel.at(kernelAddr)).isUpgraded(), 'kernel should have been upgraded')
    })

    it('fails if upgrading to kernel that is not a contract', async () => {
        await acl.createPermission(permissionsRoot, kernelAddr, APP_MANAGER_ROLE, permissionsRoot, { from: permissionsRoot })

        await assertRevert(kernel.setApp(CORE_NAMESPACE, KERNEL_APP_ID, someone))
    })
})
