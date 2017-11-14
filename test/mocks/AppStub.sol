pragma solidity 0.4.15;

import "../../contracts/apps/App.sol";

contract AppSt {
    uint a;
    bool public initialized;
}

contract AppStub is App, AppSt {
    bytes32 constant public ROLE = bytes32(1);

    function initialize() {
        require(!initialized);
        initialized = true;
    }

    function setValue(uint i) auth(ROLE) {
        a = i;
    }

    function getValue() constant returns (uint){
        return a;
    }
}

contract AppStub2 is App, AppSt {
    function getValue() constant returns (uint){
        return a * 2;
    }
}
