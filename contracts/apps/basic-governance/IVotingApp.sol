pragma solidity ^0.4.13;

contract IVotingOracle {
    function isVoteApproved(address _voteAddress, uint256 _supportPct, uint256 _minQuorumPct, uint64 _minDebateTime, uint64 _minVotingTime) constant returns (bool);
}

contract IVotingApp is IVotingOracle {
    event NewVote(uint indexed voteId, address voteAddress);
    event CastVote(uint indexed voteId, address voter, bool isYay, uint votes);
    event ChangeVoteState(uint indexed voteId, uint oldState, uint newState);

    function createVote(address _voteAddress, uint64 _voteStartsBlock, uint64 _voteEndsBlock) external;
    function voteYay(uint _voteId) public;
    function voteYayAndExecute(uint voteId) external;
    function voteNay(uint voteId) external;
    function setValidVoteCode(bytes32 _codeHash, bool _valid) external;
    function transitionStateIfChanged(uint voteId) public;

    function getVoteStatus(uint _voteId) constant returns (uint state, address voteCreator, address voteAddress, uint64 voteCreatedBlock, uint64 voteStartsBlock, uint64 voteEndsBlock, uint256 yays, uint256 nays, uint256 totalQuorum, bool validCode);
    function isVoteCodeValid(address _addr) constant returns (bool);
}
