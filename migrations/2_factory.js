const namehash = require('eth-ens-namehash').hash

const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')

module.exports = async (deployer, network) => {
    deployer.deploy(Kernel)
    deployer.deploy(KernelProxy, Kernel.address)
}
