pragma solidity 0.4.24;

import "../../../apps/AragonApp.sol";


contract AppStubScriptRunner is AragonApp {
    event ReturnedBytes(bytes returnedBytes);

    // Initialization is required to access any of the real executors
    function initialize() public {
        initialized();
    }

    function runScript(bytes script) public returns (bytes) {
        bytes memory returnedBytes = runScript(script, new bytes(0), new address[](0));
        emit ReturnedBytes(returnedBytes);
        return returnedBytes;
    }

    function runScriptWithBan(bytes script, address[] memory blacklist) public returns (bytes) {
        bytes memory returnedBytes = runScript(script, new bytes(0), blacklist);
        emit ReturnedBytes(returnedBytes);
        return returnedBytes;
    }

    function runScriptWithIO(bytes script, bytes input, address[] memory blacklist) public returns (bytes) {
        bytes memory returnedBytes = runScript(script, input, blacklist);
        emit ReturnedBytes(returnedBytes);
        return returnedBytes;
    }

    function runScriptWithNewBytesAllocation(bytes script) public returns (bytes) {
        bytes memory returnedBytes = runScript(script, new bytes(0), new address[](0));
        bytes memory newBytes = new bytes(64);

        // Fill in new bytes array with some dummy data to let us check it doesn't corrupt the
        // script's returned bytes
        uint256 first = uint256(keccak256("test"));
        uint256 second = uint256(keccak256("mock"));
        assembly {
            mstore(add(newBytes, 0x20), first)
            mstore(add(newBytes, 0x40), second)
        }
        emit ReturnedBytes(returnedBytes);
        return returnedBytes;
    }

    /*
    function getActionsCount(bytes script) public constant returns (uint256) {
        return getScriptActionsCount(script);
    }

    function getAction(bytes script, uint256 i) public constant returns (address, bytes) {
        return getScriptAction(script, i);
    }
    */
}
