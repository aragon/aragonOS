import React, { Component, PropTypes } from 'react'
import DocumentTitle from 'react-document-title'
import { config } from 'config'

export default class Md extends Component {
  render() {
    const post = this.props.route.page.data

    return (
      <DocumentTitle title={config.name}>
        <div className="markdown">
          <h1>{post.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: post.body }} />
        </div>
      </DocumentTitle>
    )
  }
}

Md.propTypes = {
  route: PropTypes.object,
}
