pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";

contract AppSt {
    uint a;
    string public stringTest;
}

contract AppStub is AragonApp, AppSt {
    bytes32 constant public ROLE = bytes32(1);

    function initialize() onlyInit {
        initialized();
        stringTest = "hola";
    }

    function requiresInitialization() isInitialized view returns (bool) {
        return true;
    }

    function setValue(uint i) auth(ROLE) {
        a = i;
    }

    function setValueParam(uint i) authP(ROLE, arr(i)) {
        a = i;
    }

    function getValue() constant returns (uint) {
        return a;
    }
}

contract AppStub2 is AragonApp, AppSt {
    function getValue() constant returns (uint){
        return a * 2;
    }
}
