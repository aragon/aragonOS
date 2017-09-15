import React, { PropTypes, Component } from 'react'
import { prefixLink } from 'gatsby-helpers'
import { Menu, Dropdown } from 'semantic-ui-react'
import { Link } from 'react-router'

export default class ContractDropdown extends Component {
  constructor(props) {
    super(props)
    this.state = { renderHack: true }
  }
  componentDidMount() {
    setTimeout(() => {
      this.setState({ renderHack: false })
    }, 0)
  }
  render() {
    if (this.state.renderHack) { return null }
    const selected = (this.props.pages || []).find(page => page.path === this.props.location.pathname)
    return (
      <Dropdown scrolling as={Menu.Item} text={selected.page.data.name}>
        <Dropdown.Menu>
          {this.props.pages.map(({ page }) => {
            return (
              <Dropdown.Item
                key={page.path}
                as={Link}
                to={prefixLink(page.path)}
                text={page.data.name}
                onClick={this.handleClick}
              />
            )
          })}
        </Dropdown.Menu>
      </Dropdown>
    )
  }
}

ContractDropdown.propTypes = {
  pages: PropTypes.array,
  location: PropTypes.object,
}
