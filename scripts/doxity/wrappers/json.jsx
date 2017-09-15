import React, { Component, PropTypes } from 'react'
import DocumentTitle from 'react-document-title'
import { config } from 'config'
import Contract from '../components/contract'

export default class Json extends Component {
  render() {
    const contract = this.props.route.page.data
    const { web3 } = this.context
    // populate contract instance
    if (web3 && contract.address) {
      contract.instance = web3.eth.contract(contract.abi).at(contract.address)
    }
    return (
      <DocumentTitle title={`${contract.name} | ${config.name}`}>
        <Contract contract={contract} />
      </DocumentTitle>
    )
  }
}
Json.contextTypes = {
  web3: PropTypes.object,
}
Json.propTypes = {
  route: PropTypes.object,
}
