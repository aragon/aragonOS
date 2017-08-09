pragma solidity ^0.4.13;

contract DAOMsgEncoder {
    /**
     * @dev Package encoding: 0th to 24th byte are all 0s (padding so entire package is 32*3 bytes) 24 to 44 bytes sender, 44 to 64 token, 64 to 96 value
     * @param _sender Address of the sender of the DAO message (Encoded from byte 24th to 44th)
     * @param _token Address of the token used to send the message (Encoded from byte 44th to 64th)
     * @param _value Value of token transfered in call
     * @return bytes payload to be appended to calldata for a DAO call
     */
    function calldataWithDAOMsg(bytes data, address _sender, address _token, uint _value) internal constant returns (bytes payload) {
        payload = new bytes(data.length + 96);
        uint dataptr; uint payloadptr;
        assembly { dataptr := add(data, 0x20) payloadptr := add(payload, 0x20) }
        memcpy(payloadptr, dataptr, data.length);
        encodeDAOMsg(payloadptr + data.length, _sender, _token, _value);
    }

    function encodeDAOMsg(uint payloadptr, address _sender, address _token, uint _value) internal {
        assembly {
            mstore(add(payloadptr, 0x40), _value) // save value in last slot
            mstore(add(payloadptr, 0x20), _token) // save token address before value, will leave first 12 bytes as 0s
            mstore(add(payloadptr, sub(0x20, 0x14)), _sender) // save sender on top of _token 0s
        }
    }

    // From @arachnid's stringutils https://github.com/Arachnid/solidity-stringutils
    function memcpy(uint dest, uint src, uint len) private {
        // Copy word-length chunks while possible
        for(; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }

}

contract DAOMsgReader {
    struct DAOMsg {
        address sender;
        address token;
        uint value;
        bytes data;
    }

    function dao_msg() internal returns (DAOMsg memory) {
        address sender;
        address token;
        uint value;
        uint padding;
        bytes memory data;

        assembly {
            padding := calldataload(sub(calldatasize(), 0x60))
            sender := calldataload(sub(calldatasize(), sub(0x60, 0x0c)))
            token := calldataload(sub(calldatasize(), 0x40))
            value := calldataload(sub(calldatasize(), 0x20))

            let size := sub(calldatasize(), 0x60) // size of data without payload
            data := mload(0x40) // get free memory pointer
            mstore(0x40, add(data, and(add(add(size, 0x20), 0x1f), not(0x1f)))) // save next free memory pointer

            mstore(data, size) // store size of the bytes array
            calldatacopy(add(data, 0x20), 0, size)
        }

        assert(padding >> 8 * 8 == 0); // assert package was correctly padded, first 24 bytes should be 0
        return DAOMsg(sender, token, value, data);
    }
}
