function assertError(error, s, message) {
    assert.isAbove(error.message.search(s), -1, message);
}

async function assertThrows(codeBlock, message, errorCode) {
    try {
        await codeBlock()
    } catch (e) {
        return assertError(e, errorCode, message)
    }
    assert.fail('should have thrown before')
}

module.exports = {
    async assertJump(codeBlock, message = 'should have failed with invalid JUMP') {
        return assertThrows(codeBlock, message, 'invalid JUMP')
    },

    async assertInvalidOpcode(codeBlock, message = 'should have failed with invalid opcode') {
        return assertThrows(codeBlock, message, 'invalid opcode')
    },

    async assertRevert(codeBlock, message = 'should have failed by reverting') {
        return assertThrows(codeBlock, message, 'revert')
    },
}
