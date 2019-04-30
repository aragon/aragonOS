pragma solidity 0.4.24;

import "../../kill_switch/KillSwitchedApp.sol";


contract KillSwitchedAppMock is KillSwitchedApp {
    address public owner;
    uint256 internal data;

    function initialize(KillSwitch _killSwitch, address _owner) public onlyInit {
        super.initialize(_killSwitch);
        data = 42;
        owner = _owner;
    }

    function read() public view returns (uint256) {
        return data;
    }

    function write(uint256 _data) public killSwitched {
        data = _data;
    }

    function reset() public killSwitched {
        data = 0;
    }
}
