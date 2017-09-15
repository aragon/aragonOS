import React, { PropTypes, Component } from 'react'

export default class Bytecode extends Component {
  render() {
    const { contract } = this.props
    return (
      <div className="bytecode">
        {contract.bin &&
          <div className="bin">
            <h3>Hex</h3>
            <pre className="wrap">
              <code>{contract.bin}</code>
            </pre>
          </div>
        }
        {contract.opcodes &&
          <div className="opcodes">
            <h3>Opcodes</h3>
            <pre className="wrap">
              <code>{contract.opcodes}</code>
            </pre>
          </div>
        }
      </div>
    )
  }
}

Bytecode.propTypes = {
  contract: PropTypes.object,
}
