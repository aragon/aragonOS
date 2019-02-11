pragma solidity 0.4.24;

import "../../apps/AragonApp.sol";
import "../../apps/UnsafeAragonApp.sol";
import "../../kernel/IKernel.sol";


contract AppStubStorage {
    uint a;
    string public stringTest;
}

contract AppStub is AragonApp, AppStubStorage {
    bytes32 public constant ROLE = keccak256("ROLE");

    function initialize() onlyInit public {
        initialized();
        stringTest = "hola";
    }

    function requiresInitialization() isInitialized public constant returns (bool) {
        return true;
    }

    function setValue(uint i) auth(ROLE) public {
        a = i;
    }

    function getValue() public constant returns (uint) {
        return a;
    }
}

contract AppStub2 is AragonApp, AppStubStorage {
    function getValue() public constant returns (uint) {
        return a * 2;
    }
}

contract UnsafeAppStub is AppStub, UnsafeAragonApp {
    constructor(IKernel _kernel) public {
        setKernel(_kernel);
    }
}
