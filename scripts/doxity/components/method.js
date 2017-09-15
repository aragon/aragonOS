import React, { PropTypes, Component } from 'react'
import { Input, Table, Segment, Label, Header } from 'semantic-ui-react'
import ReactMarkdown from 'react-markdown'

export default class Method extends Component {
  constructor(props) {
    super(props)
    this.renderParams = this.renderParams.bind(this)
    this.handleUpdateParam = this.handleUpdateParam.bind(this)
    this.state = { inputs: [], outputs: [] }
  }
  componentDidMount() {
    if (this.props.method.type === 'function' && this.props.method.inputs.length === 0) {
      this.handleRequest()
    }
  }
  handleRequest() {
    const { method, contract } = this.props
    const calledMethod = contract.instance[method.name]
    calledMethod.call.apply(calledMethod, [...this.state.inputs, (err, res) => {
      const results = Array.isArray(res) ? res : [res]
      // format bignumbers
      const outputs = results.map((out) => (out.toNumber ? `${out.toNumber()}` : `${out}`))
      this.setState({ outputs })
    }])
  }
  handleUpdateParam(e, i) {
    const { method } = this.props
    const { inputs } = this.state
    inputs[i] = e.target.value
    this.setState({ inputs })
    const ready = new Array(method.inputs.length).fill().map((k, j) => j).find(j => !this.state.inputs[j]) === undefined
    if (ready) { this.handleRequest(method) }
  }
  renderParams(type) {
    const { method, contract } = this.props
    const { outputs } = this.state
    const params = method[type]
    return params.map((param, i) => {
      const inputs = type === 'inputs'
      return (
        <Table.Row key={i} negative={!inputs} positive={inputs}>
          {i === 0 ?
            <Table.Cell
              style={{ textTransform: 'capitalize' }}
              rowSpan={params.length}
            >
              {type}
            </Table.Cell>
          :
            <Table.Cell style={{ display: 'none' }}>{type}</Table.Cell>
          }
          <Table.Cell>{`${i}`}</Table.Cell>
          <Table.Cell>{param.type}</Table.Cell>
          <Table.Cell>
            {param.name && <code>{param.name}</code>}
          </Table.Cell>
          <Table.Cell>
            {param.description && <ReactMarkdown source={param.description} />}
          </Table.Cell>
          {contract.address && method.outputs.length > 0 &&
            <Table.Cell textAlign="right">
              {inputs ?
                <Input
                  className="method-input"
                  placeholder={param.name}
                  onChange={(e) => this.handleUpdateParam(e, i)}
                />
              :
                outputs[i]
              }
            </Table.Cell>
          }
        </Table.Row>
      )
    })
  }
  render() {
    const { method, contract } = this.props
    // color segment based on type
    const colors = {
      event: 'blue',
      constructor: 'red',
    }
    const color = colors[method.type]
    return (
      <Segment color={color}>
        <Label ribbon="right" color={color}>
          {method.type}
          {method.payable && ', payable'}
          {method.constant && ', constant'}
        </Label>
        <Header style={{ marginTop: '-1.5rem' }} as="h3">
          <code>{method.name || contract.name}</code>
          {' '}
          {method.signatureHash && <code className="signature">{method.signatureHash}</code>}
        </Header>
        {method.notice && <ReactMarkdown containerTagName="h4" source={method.notice} />}
        {method.details && <ReactMarkdown source={method.details} />}
        {(method.inputs.length || method.outputs) &&
          <Table definition>
            <Table.Body>
              {method.inputs && this.renderParams('inputs')}
              {method.outputs && this.renderParams('outputs')}
            </Table.Body>
          </Table>
        }
      </Segment>
    )
  }
}

Method.propTypes = {
  method: PropTypes.object,
  contract: PropTypes.object,
}
