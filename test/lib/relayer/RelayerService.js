const { skipCoverage } = require('../../helpers/coverage')
const { getEventArgument, getNewProxyAddress } = require('../../helpers/events')

const RelayerService = require('../../../lib/relayer/RelayerService')(artifacts, web3)
const RelayTransactionSigner = require('../../../lib/relayer/RelayTransactionSigner')(web3)

const ACL = artifacts.require('ACL')
const Kernel = artifacts.require('Kernel')
const Relayer = artifacts.require('RelayerMock')
const DAOFactory = artifacts.require('DAOFactory')
const SampleApp = artifacts.require('RelayedAppMock')

const NOW = 1557945653

contract('RelayerService', ([_, root, member, someone, vault, offChainRelayerService]) => {
  let daoFactory, dao, acl, app, relayer, service, signer
  let kernelBase, aclBase, sampleAppBase, relayerBase
  let WRITING_ROLE, APP_MANAGER_ROLE, RELAYER_APP_ID
  let SET_MONTHLY_REFUND_QUOTA_ROLE, ALLOW_SENDER_ROLE, DISALLOW_SENDER_ROLE, ALLOW_OFF_CHAIN_SERVICE_ROLE, DISALLOW_OFF_CHAIN_SERVICE_ROLE

  const GAS_PRICE = 10e9
  const MONTHLY_REFUND_GAS = 1e6 * 5
  const MONTHLY_REFUND_QUOTA = MONTHLY_REFUND_GAS * GAS_PRICE

  const SEND_ETH_GAS = 31000 // 21k base tx cost + 10k limit on depositable proxies

  before('deploy base implementations', async () => {
    aclBase = await ACL.new()
    kernelBase = await Kernel.new(true) // petrify immediately
    relayerBase = await Relayer.new()
    sampleAppBase = await SampleApp.new()
    daoFactory = await DAOFactory.new(kernelBase.address, aclBase.address, '0x0')
  })

  before('load constants', async () => {
    RELAYER_APP_ID = await kernelBase.DEFAULT_RELAYER_APP_ID()
    WRITING_ROLE = await sampleAppBase.WRITING_ROLE()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    SET_MONTHLY_REFUND_QUOTA_ROLE = await relayerBase.SET_MONTHLY_REFUND_QUOTA_ROLE()
    ALLOW_SENDER_ROLE = await relayerBase.ALLOW_SENDER_ROLE()
    DISALLOW_SENDER_ROLE = await relayerBase.DISALLOW_SENDER_ROLE()
    ALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.ALLOW_OFF_CHAIN_SERVICE_ROLE()
    DISALLOW_OFF_CHAIN_SERVICE_ROLE = await relayerBase.DISALLOW_OFF_CHAIN_SERVICE_ROLE()
  })

  before('deploy DAO', async () => {
    const receipt = await daoFactory.newDAO(root)
    dao = Kernel.at(getEventArgument(receipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
  })

  before('create sample app instance', async () => {
    const receipt = await dao.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
    app = SampleApp.at(getNewProxyAddress(receipt))
    await app.initialize()
    await acl.createPermission(member, app.address, WRITING_ROLE, root, { from: root })
  })

  beforeEach('create and initialize relayer instance', async () => {
    const receipt = await dao.newAppInstance(RELAYER_APP_ID, relayerBase.address, '0x', true, { from: root })
    relayer = Relayer.at(getNewProxyAddress(receipt))

    await relayer.mockSetTimestamp(NOW)
    await relayer.initializeWithChainId(MONTHLY_REFUND_QUOTA, Relayer.network_id)

    await acl.createPermission(root, relayer.address, ALLOW_SENDER_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, DISALLOW_SENDER_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, SET_MONTHLY_REFUND_QUOTA_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, ALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
    await acl.createPermission(root, relayer.address, DISALLOW_OFF_CHAIN_SERVICE_ROLE, root, { from: root })
  })

  beforeEach('create and initialize relayer service', async () => {
    signer = new RelayTransactionSigner(relayer)
    service = new RelayerService(offChainRelayerService, relayer)
    await relayer.allowService(offChainRelayerService, { from: root })
  })

  beforeEach('allow sender and fund relayer', async () => {
    await relayer.allowSender(member, { from: root })
    await web3.eth.sendTransaction({ from: vault, to: relayer.address, value: MONTHLY_REFUND_QUOTA, gas: SEND_ETH_GAS })
  })

  describe('relay', () => {
    let data

    beforeEach('build transaction data', () => data = app.contract.write.getData(10))

    context('when the relayed call does not revert', () => {
      context('when the target address is an aragon app', () => {
        context('when the target aragon app belongs to the same DAO', () => {
          context('when the given gas amount does cover the transaction cost', () => {
            context('when the given gas price is above the average', () => {
              it('relays transactions to app', skipCoverage(async () => {
                const transaction = await signer.signTransaction({ from: member, to: app.address, data })
                await service.relay(transaction)

                assert.equal((await app.read()).toString(), 10, 'app value does not match')
              }))
            })

            context('when the given gas price is below the average', () => {
              const gasPrice = 1

              it('throws an error', skipCoverage(async () => {
                const transaction = await signer.signTransaction({ from: member, to: app.address, data, gasPrice })
                
                await assertRejects(service.relay(transaction), /Given gas price is below the average \d*/)
              }))
            })
          })

          context('when the given gas amount does not cover the transaction cost', () => {
            const gasRefund = 5000

            it('throws an error', skipCoverage(async () => {
              const transaction = await signer.signTransaction({ from: member, to: app.address, data, gasRefund })

              await assertRejects(service.relay(transaction), /Given gas refund amount \d* does not cover transaction gas cost \d*/)
            }))
          })
        })

        context('when the target aragon app belongs to another DAO', () => {
          let foreignDAO, foreignApp

          beforeEach('deploy app from another DAO', async () => {
            const receiptForeignDAO = await daoFactory.newDAO(root)
            foreignDAO = Kernel.at(getEventArgument(receiptForeignDAO, 'DeployDAO', 'dao'))
            const foreignACL = ACL.at(await foreignDAO.acl())
            await foreignACL.createPermission(root, foreignDAO.address, APP_MANAGER_ROLE, root, { from: root })

            const receiptForeignApp = await foreignDAO.newAppInstance('0x22222', sampleAppBase.address, '0x', false, { from: root })
            foreignApp = SampleApp.at(getNewProxyAddress(receiptForeignApp))
            foreignApp.initialize()
            await foreignACL.createPermission(someone, foreignApp.address, WRITING_ROLE, root, { from: root })
          })

          it('throws an error', skipCoverage(async () => {
            const transaction = await signer.signTransaction({ from: someone, to: foreignApp.address, data })

            await assertRejects(service.relay(transaction), `The Kernel of the target app ${foreignDAO.address} does not match with the Kernel of the current realyer ${dao.address}`)
          }))
        })
      })

      context('when the target address is not an aragon app', () => {
        it('throws an error', skipCoverage(async () => {
          const transaction = await signer.signTransaction({ from: member, to: someone, data })

          await assertRejects(service.relay(transaction), `The Kernel of the target app 0x does not match with the Kernel of the current realyer ${dao.address}`)
        }))
      })
    })

    context('when the relayed call reverts', () => {
      it('throws an error', skipCoverage(async () => {
        const transaction = await signer.signTransaction({ from: member, to: app.address, data })

        // change the transaction sender
        transaction.from = someone

        await assertRejects(service.relay(transaction), /Will not relay failing transaction.*RELAYER_SENDER_NOT_ALLOWED/)
      }))
    })
  })
})

async function assertRejects(promise, regExp) {
  let f
  try {
    await promise
  } catch (e) {
    f = () => { throw e }
  } finally {
    assert.throws(f, regExp)
  }
}
