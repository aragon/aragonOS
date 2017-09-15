import React, { PropTypes, Component } from 'react'

import hljs from 'highlight.js'
import hljsDefineSolidity from 'highlightjs-solidity'
import '../css/hljs-atom-one.css'

hljsDefineSolidity(hljs)

export default class Source extends Component {
  constructor(props) {
    super(props)
    this.state = {}
  }
  componentDidMount() {
    hljs.highlightBlock(this.refs.highlight)
  }
  componentWillReceiveProps() {
    this.state = { renderHack: true }
    setTimeout(() => {
      this.setState({ renderHack: false })
      hljs.highlightBlock(this.refs.highlight)
    }, 0)
  }
  render() {
    const { contract } = this.props
    return (
      <div className="source">
        {!this.state.renderHack &&
          <pre ref="highlight">
            <code>{contract.source}</code>
          </pre>
        }
      </div>
    )
  }
}

Source.propTypes = {
  contract: PropTypes.object,
}
