module.exports = {
    norpc: true,
    compileCommand: '../node_modules/.bin/truffle compile',
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: ['*/I*', 'zeppelin', 'misc/Migrations.sol', 'ens/*ENS.sol', 'ens/PublicResolver.sol'],
    copyNodeModules: true,
}
