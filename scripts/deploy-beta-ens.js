const ENSFactory = artifacts.require('ENSFactory')

const owner = process.env.OWNER || '0x4cb3fd420555a09ba98845f0b816e45cfb230983'

module.exports = async callback => {
  console.log('deploying factory')
  const factory = await ENSFactory.new()
  console.log('factory deployed', factory.address)
  const receipt = await factory.newENS(owner)

  const ens = receipt.logs.filter(l => l.event == 'DeployENS')[0].args.ens
  console.log('====================')
  console.log('Deployed ENS:', ens)

  console.log(ens)
}

// Rinkeby ENS: 0xfbae32d1cde62858bc45f51efc8cc4fa1415447e
