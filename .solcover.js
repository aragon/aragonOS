module.exports = {
    norpc: true,
    testCommand: 'node --max-old-space-size=0 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: require('glob').sync('contracts/lib/**/*.sol').map(n => n.replace('contracts/', '')),
    copyNodeModules: true,
}
