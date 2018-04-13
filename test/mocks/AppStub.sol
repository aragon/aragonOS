pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";

contract AppSt {
    uint a;
    string public stringTest;
}

contract AppStub is AragonApp, AppSt {
    bytes32 constant public ROLE = bytes32(1);

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

    function setValueParam(uint i) authP(ROLE, arr(i)) public {
        a = i;
    }

    function getValue() public constant returns (uint) {
        return a;
    }
}

contract AppStub2 is AragonApp, AppSt {
    function getValue() public constant returns (uint) {
        return a * 2;
    }
}
