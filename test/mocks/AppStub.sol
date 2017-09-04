pragma solidity 0.4.15;

import "../../contracts/apps/App.sol";

contract AppSt {
    uint a;
}

contract AppStub is App, AppSt {
    function setValue(uint i) auth {
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
