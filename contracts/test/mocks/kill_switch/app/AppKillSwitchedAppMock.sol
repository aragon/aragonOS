pragma solidity 0.4.24;

import "../../../../kill_switch/app/KillSwitchedApp.sol";


contract AppKillSwitchedAppMock is KillSwitchedApp {
    address public owner;
    uint256 internal data;

    function initialize(AppKillSwitch _appKillSwitch, address _owner) public onlyInit {
        super.initialize(_appKillSwitch);
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
