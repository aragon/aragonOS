pragma solidity 0.4.18;

import "../../contracts/kernel/Kernel.sol";

contract KernelSetAppMock is Kernel {
    function KernelSetAppMock() Kernel(false) public {
    }

    // Overloaded mock to bypass the auth and isContract checks
    function setApp(bytes32 _namespace, bytes32 _name, address _app) public returns (bytes32 id) {
        id = keccak256(_namespace, _name);
        apps[id] = _app;
    }
}
