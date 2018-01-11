pragma solidity 0.4.18;


contract ScriptHelpers {
    uint256 constant START_LOCATION = 4;

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
}
