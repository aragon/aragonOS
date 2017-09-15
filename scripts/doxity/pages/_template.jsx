import React, { Component, PropTypes } from 'react'
import Web3 from 'web3'
import { Link } from 'react-router'
import { prefixLink } from 'gatsby-helpers'
import { config } from 'config'
import { Menu, Container, Label, Segment, Grid, Icon } from 'semantic-ui-react'
import '../css/style.scss'

import ContractDropdown from '../components/contractDropdown'

// show web3 if config wants it

export default class Index extends Component {
  constructor(props) {
    super(props)
    // TODO metamask/mist?
    if (config.interaction && config.interaction.providerUrl) {
      this.web3 = new Web3()
      this.web3.setProvider(new this.web3.providers.HttpProvider(config.interaction.providerUrl))
    }
  }
  getChildContext() {
    return { web3: this.web3 }
  }
  render() {
    const onIndex = prefixLink('/') === this.props.location.pathname
    const docsRoute = this.props.route.childRoutes.find(route => route.path === prefixLink('/docs/'))
    const childRoutes = docsRoute && docsRoute.childRoutes
    const docsPath = childRoutes && childRoutes[0].path

    return (
      <div style={{ paddingTop: '60px' }} className="pusher">
        <Menu inverted fixed="top">
          <Container>
            <Menu.Item header as={Link} to={prefixLink('/')}>
              {config.name}
              <Label color="grey">{config.version}</Label>
            </Menu.Item>
            <Menu.Item className="mobile hidden">{config.description}</Menu.Item>
            {docsPath &&
              <Menu.Menu position="right">
                {onIndex ?
                  <Menu.Item as={Link} to={docsPath}>Contracts</Menu.Item>
                :
                  <ContractDropdown pages={childRoutes} location={this.props.location} />
                }
                {config.homepage &&
                  <Menu.Item as={'a'} target="_blank" href={config.homepage}>
                    <Icon name="home" />
                  </Menu.Item>
                }
              </Menu.Menu>
            }
          </Container>
        </Menu>
        <Container>
          {this.props.children}
        </Container>
        <Container className="footer">
          <Segment secondary size="small" attached="top" compact>
            <Grid stackable>
              <Grid.Row>
                <Grid.Column width={6}>
                  <b>&copy; {config.author}</b> - {config.license}, {new Date(config.buildTime).getFullYear()}
                </Grid.Column>
                <Grid.Column width={10} textAlign="right">
                  Docs built using <b>Solidity {config.compiler}</b> on <b>{new Date(config.buildTime).toLocaleDateString()}</b>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Segment>
        </Container>
      </div>
    )
  }
}
Index.childContextTypes = {
  web3: PropTypes.object,
}
Index.propTypes = {
  children: PropTypes.object,
  location: PropTypes.object,
  route: PropTypes.object,
}
