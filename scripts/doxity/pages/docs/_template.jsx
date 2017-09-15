import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'
import { prefixLink } from 'gatsby-helpers'
import { Grid, Menu } from 'semantic-ui-react'


export default class Docs extends Component {
  constructor(props) {
    super(props)
    this.renderDocMenu = this.renderDocMenu.bind(this)
  }
  handleTopicChange(e) {
    return this.context.router.push(e.target.value)
  }
  renderDocMenu() {
    return (
      <Menu fluid vertical tabular>
        {this.props.route.childRoutes.map((child) => {
          const isActive = child.path === this.props.location.pathname
          return (
            <Menu.Item key={child.path} as={Link} to={child.path} active={isActive} onClick={this.handleItemClick}>
              {child.page.data.name}
            </Menu.Item>
          )
        })}
      </Menu>
    )
  }
  render() {
    return (
      <Grid>
        <Grid.Column className="mobile hidden" width={4}>
          {this.renderDocMenu()}
        </Grid.Column>
        <Grid.Column stretched computer={12} tablet={12} mobile={16}>
          {this.props.children}
        </Grid.Column>
      </Grid>
    )
  }
}

Docs.contextTypes = {
  router: PropTypes.object,
}
Docs.propTypes = {
  route: PropTypes.object,
  location: PropTypes.object,
  children: PropTypes.node,
}
