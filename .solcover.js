module.exports = {
    norpc: true,
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    skipFiles: ['network/AragonResolver.sol', 'misc/Migrations.sol'],
    copyNodeModules: true,
}
