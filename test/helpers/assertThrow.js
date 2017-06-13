module.exports = function(error) {
  const isError = error.message.search('invalid opcode') > -1 || error.message.search('invalid JUMP') > -1
  assert.isTrue(isError, 'Error expected');
}
