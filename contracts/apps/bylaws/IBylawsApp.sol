pragma solidity ^0.4.13;

import "../../kernel/IPermissionsOracle.sol";

contract IBylawsApp {
    event BylawChanged(bytes4 sig, uint bylawType, uint256 bylawId, address changedBy);

    function linkBylaw(bytes4 _sig, uint _id) external;

    function setStatusBylaw(uint8 _statusNeeded, bool _isTokenHolderStatus, bool _not) external returns (uint);
    function setAddressBylaw(address _addr, bool _isOracle, bool _not) external returns (uint);
    function setVotingBylaw(uint256 _supportPct, uint256 _minQuorumPct, uint64 _minDebateTime, uint64 _minVotingTime, bool _not) external returns (uint);
    function setCombinatorBylaw(uint _combinatorType, uint _leftBylawId, uint _rightBylawId, bool _not) external returns (uint);

    function getBylawType(uint bylawId) constant returns (uint);

    function getBylawNot(uint bylawId) constant returns (bool);
    function getStatusBylaw(uint256 bylawId) constant returns (uint);
    function getAddressBylaw(uint256 bylawId) constant returns (address);
    function getVotingBylaw(uint256 bylawId) constant returns (uint256 supportPct, uint256 minQuorumPct, uint64 minDebateTime, uint64 minVotingTime);
    function getCombinatorBylaw(uint256 bylawId) constant returns (uint combinatorType, uint leftBylawId, uint rightBylawId);
}
