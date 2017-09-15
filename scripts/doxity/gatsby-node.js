exports.modifyWebpackConfig = (config) => {
  config.merge({
    resolve: {
      alias: {
        'semantic-ui-react': '@hitchcott/semantic-ui-react',
      },
    },
  })
  return config
}
