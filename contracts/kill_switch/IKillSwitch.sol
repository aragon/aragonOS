pragma solidity 0.4.24;

import "./IIssuesRegistry.sol";


contract IKillSwitch {
    function initialize(IIssuesRegistry _issuesRegistry) external;

    function shouldDenyCallingContract(address _contract) external returns (bool);
}
