import React, { PropTypes, Component } from 'react'
import { config } from 'config'

export default class ShortAddressLink extends Component {
  render() {
    const { interaction } = config
    if (!interaction) { return null }
    const { address } = this.props
    const urlPrefix = interaction.network === '2' ? 'testnet.' : ''
    const url = `https://${urlPrefix}etherscan.io/address/${address}`
    return (
      <a target="_blank" href={url}>{address}</a>
    )
  }
}

ShortAddressLink.propTypes = {
  address: PropTypes.string.isRequired,
}
