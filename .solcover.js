module.exports = {
    norpc: true,
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: ['zeppelin/math/Math.sol', 'zeppelin/math/SafeMath.sol', 'misc/Migrations.sol'],
    copyNodeModules: true,
}
