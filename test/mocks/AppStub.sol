pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";

contract AppSt {
    uint a;
    bool public initialized;
    string public stringTest;
}

contract AppStub is AragonApp, AppSt {
    bytes32 constant public ROLE = bytes32(1);

    function initialize() {
        require(!initialized);
        initialized = true;
        stringTest = "hola";
    }

    function setValue(uint i) auth(ROLE) {
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
