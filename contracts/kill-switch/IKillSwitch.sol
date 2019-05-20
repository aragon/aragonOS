pragma solidity 0.4.24;

import "./IIssuesRegistry.sol";


contract IKillSwitch {
    function shouldDenyCallingApp(bytes32 _appId, address _base, address _proxy) external view returns (bool);
}
