pragma solidity 0.4.18;


library ScriptHelpers {
    // t = function() { return IEVMScriptExecutor.at('0x4bcdd59d6c77774ee7317fc1095f69ec84421e49').contract.execScript.getData(...[].slice.call(arguments)).slice(10).match(/.{1,64}/g) }
    // run = function() { return ScriptHelpers.new().then(sh => { sh.abiEncode.call(...[].slice.call(arguments)).then((a, l) => { console.log(l); console.log(a.match(/.{1,64}/g)) } ) }) }
    // This is truly not beautiful but lets no daydream to the day solidity gets reflection features
    function abiEncode(bytes a, bytes memory b, address[] c) view returns (bytes d) {
        // A is position after the 3 position words
        uint256 bPosition = 96 + 32 * abiLength(a);
        uint256 cPosition = bPosition + 32 * abiLength(b);
        uint256 length    = cPosition + 32 * abiLength(c);

        d = new bytes(length);
        assembly {
            // Store positions
            mstore(add(d, 0x20), 0x60)
            mstore(add(d, 0x40), bPosition)
            mstore(add(d, 0x60), cPosition)
        }

        copy(d, a, 96);
        copy(d, b, bPosition);
        copy(d, c, cPosition);
    }

    function copy(bytes d, bytes a, uint256 pos) internal {
        uint dest; uint src;
        assembly {
            src  := a
            dest := add(add(d, 0x20), pos)
        }
        memcpy(dest, src, a.length + 32);
    }

    function copy(bytes d, address[] a, uint256 pos) internal {
        uint dest; uint src;
        assembly {
            src  := a
            dest := add(add(d, 0x20), pos)
        }
        memcpy(dest, src, 32 * a.length + 32);
    }

    function abiLength(bytes memory a) internal pure returns (uint256) {
        // 1 for length +
        // memory words + 1 if not divisible for 32 to offset word
        return 1 + (a.length / 32) + (a.length % 32 > 0 || a.length == 0 ? 1 : 0);
    }

    function abiLength(address[] a) internal pure returns (uint256) {
        // 1 for length + 1 per item
        return 1 + a.length;
    }

    function getSpecId(bytes script) internal pure returns (uint32) {
        return uint32At(script, 0);
    }

    function uint256At(bytes data, uint256 location) internal pure returns (uint256 result) {
        assembly {
            result := mload(add(data, add(0x20, location)))
        }
    }

    function addressAt(bytes data, uint256 location) internal pure returns (address result) {
        uint256 word = uint256At(data, location);

        assembly {
            result := div(and(word, 0xffffffffffffffffffffffffffffffffffffffff000000000000000000000000),
            0x1000000000000000000000000)
        }
    }

    function uint32At(bytes data, uint256 location) internal pure returns (uint32 result) {
        uint256 word = uint256At(data, location);

        assembly {
            result := div(and(word, 0xffffffff00000000000000000000000000000000000000000000000000000000),
            0x100000000000000000000000000000000000000000000000000000000)
        }
    }

    function locationOf(bytes data, uint256 location) internal pure returns (uint256 result) {
        assembly {
            result := add(data, add(0x20, location))
        }
    }

    function toBytes(bytes4 _sig) internal pure returns (bytes) {
        bytes memory payload = new bytes(4);
        payload[0] = bytes1(_sig);
        payload[1] = bytes1(_sig << 8);
        payload[2] = bytes1(_sig << 16);
        payload[3] = bytes1(_sig << 24);
        return payload;
    }

    function memcpy(uint _dest, uint _src, uint _len) public pure {
        uint256 src = _src;
        uint256 dest = _dest;
        uint256 len = _len;

        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
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
