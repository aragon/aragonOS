pragma solidity ^0.4.13;


// Could be converted into a library. Would it be worth it gas wise?
contract CodeHelper {
    // TODO: When we migrate to solc 0.4.12, use so we save the copy
    // switch size case 0 { hash := 0 }
    function hashForCode(address _addr) constant returns (bytes32 hash) {
        uint size = contractSize(_addr);
        if (size == 0)
            return bytes32(0);
        assembly {
            let o_code := mload(0x40)
            mstore(0x40, add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(o_code, size)
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
            hash := sha3(add(o_code, 0x20), size)
        }
    }

    function contractSize(address _addr) internal constant returns (uint size) {
        assembly { size := extcodesize(_addr) }
    }
}
