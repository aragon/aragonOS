import React, { PropTypes, Component } from 'react'
import hljs from 'highlight.js'

export default class Abi extends Component {
  componentDidMount() {
    hljs.highlightBlock(this.refs.highlight)
  }
  render() {
    const { contract } = this.props
    return (
      <div className="abi">
        <h3>ABI</h3>
        <pre ref="highlight">
          <code>{JSON.stringify(contract.abi, null, 2)}</code>
        </pre>
      </div>
    )
  }
}

Abi.propTypes = {
  contract: PropTypes.object,
}
