import React, { PropTypes, Component } from 'react'

import sortBy from 'sort-by'

import Method from './method'

export default class Methods extends Component {
  render() {
    const { contract } = this.props
    return (
      <div className="methods">
        {contract.abiDocs.sort(sortBy('type', 'name')).map((method) => {
          return <Method key={`${contract.name}${method.signature}`} method={method} contract={contract} />
        })}
      </div>
    )
  }
}

Methods.propTypes = {
  contract: PropTypes.object,
}
