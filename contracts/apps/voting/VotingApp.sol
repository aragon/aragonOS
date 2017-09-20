pragma solidity 0.4.15;

import "../App.sol";

import "../../common/EVMCallScript.sol";
import "../../common/Initializable.sol";
import "../../common/MiniMeToken.sol";
import "../../common/IForwarder.sol";

import "../../zeppelin/math/SafeMath.sol";

contract VotingApp is App, Initializable, EVMCallScriptRunner, EVMCallScriptDecoder, IForwarder {
    using SafeMath for uint256;

    MiniMeToken public token;
    uint256 public supportRequiredPct;
    uint256 public minAcceptQuorumPct;
    uint64 public voteTime;

    uint256 constant PCT_BASE = 10 ** 18;

    enum VoterState { Absent, Yea, Nay }

    struct Voting {
        address creator;
        uint64 startDate;
        uint256 snapshotBlock;
        uint256 yea;
        uint256 nay;
        uint256 totalVoters;
        string metadata;
        bytes executionScript;
        bool open;
        bool executed;
        mapping (address => VoterState) voters;
    }

    Voting[] votings;

    event StartVote(uint256 indexed votingId);
    event CastVote(uint256 indexed votingId, address indexed voter, bool supports);
    event ExecuteVote(uint256 indexed votingId);

    /**
    * @notice Initializes VotingApp (some parameters won't be modifiable after being set)
    * @param _token MiniMeToken address that will be used as governance token
    * @param _supportRequiredPct Percentage of voters that must support a voting for it to succeed (expressed as a 10^18 percetage, (eg 10^16 = 1%, 10^18 = 100%)
    * @param _minAcceptQuorumPct Percetage of total voting power that must support a voting  for it to succeed (expressed as a 10^18 percetage, (eg 10^16 = 1%, 10^18 = 100%)
    * @param _voteTime Seconds that a voting will be open for token holders to vote (unless it is impossible for the fate of the vote to change)
    */
    function initialize(MiniMeToken _token, uint256 _supportRequiredPct, uint256 _minAcceptQuorumPct, uint64 _voteTime) onlyInit {
        initialized();

        require(_supportRequiredPct <= PCT_BASE);
        require(_supportRequiredPct >= _minAcceptQuorumPct);

        token = _token;
        supportRequiredPct = _supportRequiredPct;
        minAcceptQuorumPct = _minAcceptQuorumPct;
        voteTime = _voteTime;

        votings.length += 1;
    }

    /**
    * @notice Change minimum acceptance quorum to `_minAcceptQuorumPct`
    * @param _minAcceptQuorumPct New acceptance quorum
    */
    function changeMinAcceptQuorumPct(uint256 _minAcceptQuorumPct) auth external {
        require(supportRequiredPct >= _minAcceptQuorumPct);
        minAcceptQuorumPct = _minAcceptQuorumPct;
    }

    /**
    * @notice Create new voting to execute `_executionScript`
    * @param _executionScript EVM script to be executed on approval
    * @return votingId id for newly created vote
    */
    bytes4 constant NEW_VOTING_ACTION = bytes4(sha3('newVoting(bytes,string)'));
    function newVoting(bytes _executionScript, string _metadata) auth external returns (uint256 votingId) {
        return _newVoting(_executionScript, _metadata);
    }

    /**
    * @notice Vote `_supports` in vote with id `_votingId`
    * @param _votingId Id for vote
    * @param _supports Whether voter supports the voting
    */
    function vote(uint256 _votingId, bool _supports) external {
        require(canVote(_votingId, msg.sender));
        _vote(_votingId, _supports, msg.sender);
    }

    /**
    * @notice Execute the result of vote `_votingId`
    * @param _votingId Id for vote
    */
    function executeVote(uint256 _votingId) external {
        require(canExecute(_votingId));
        _executeVote(_votingId);
    }

    /**
    * @dev IForwarder interface conformance
    * @param _evmCallScript Start vote with script
    */
    function forward(bytes _evmCallScript) external {
        require(canForward(msg.sender, _evmCallScript));
        _newVoting(_evmCallScript, "");
    }

    function canForward(address _sender, bytes _evmCallScript) constant returns (bool) {
        _evmCallScript;
        return canPerform(_sender, NEW_VOTING_ACTION);
    }

    function canVote(uint256 _votingId, address _voter) constant returns (bool) {
        Voting storage voting = votings[_votingId];

        return voting.open &&
               uint64(now) < (voting.startDate + voteTime) &&
               token.balanceOfAt(_voter, voting.snapshotBlock) > 0;
    }

    function canExecute(uint256 _votingId) constant returns (bool) {
        Voting storage voting = votings[_votingId];

        // Voting is already decided
        if (voting.yea >= pct(voting.totalVoters, supportRequiredPct))
            return true;

        uint256 totalVotes = voting.yea + voting.nay;
        if (uint64(now) >= (voting.startDate + voteTime) &&
            voting.yea >= pct(totalVotes, supportRequiredPct) &&
            voting.yea >= pct(voting.totalVoters, minAcceptQuorumPct))
            return true;

        return false;
    }

    function getVoting(uint256 _votingId) constant returns (bool open, bool executed, address creator, uint64 startDate, uint256 snapshotBlock, uint256 yea, uint256 nay, uint256 totalVoters, bytes32 scriptHash, uint256 scriptActionsCount) {
        Voting storage voting = votings[_votingId];

        open = voting.open;
        executed = voting.executed;
        creator = voting.creator;
        startDate = voting.startDate;
        snapshotBlock = voting.snapshotBlock;
        yea = voting.yea;
        nay = voting.nay;
        totalVoters = voting.totalVoters;
        scriptHash = sha3(voting.executionScript);
        scriptActionsCount = getScriptActionsCount(voting.executionScript);
    }

    function getVotingMetadata(uint256 _votingId) constant returns (string metadata) {
        return votings[_votingId].metadata;
    }

    function getVotingScriptAction(uint256 _votingId, uint256 _scriptAction) constant returns (address, bytes) {
        return getScriptAction(votings[_votingId].executionScript, _scriptAction);
    }

    function _newVoting(bytes _executionScript, string _metadata) internal returns (uint256 votingId) {
        votingId = votings.length++;
        Voting storage voting = votings[votingId];
        voting.executionScript = _executionScript;
        voting.creator = msg.sender;
        voting.startDate = uint64(now);
        voting.open = true;
        voting.metadata = _metadata;
        voting.snapshotBlock = getBlockNumber() - 1; // avoid double voting in this very block
        voting.totalVoters = token.totalSupplyAt(voting.snapshotBlock);

        StartVote(votingId);

        if (canVote(votingId, msg.sender)) _vote(votingId, true, msg.sender);
    }

    function _vote(uint256 _votingId, bool _supports, address _voter) internal {
        Voting storage voting = votings[_votingId];

        // this could re-enter, though we can asume the governance token is not maliciuous
        uint256 voterStake = token.balanceOfAt(_voter, voting.snapshotBlock);
        VoterState state = voting.voters[_voter];

        // if voter had previously voted, decrease count
        if (state == VoterState.Yea) voting.yea = voting.yea.sub(voterStake);
        if (state == VoterState.Nay) voting.nay = voting.nay.sub(voterStake);

        if (_supports) voting.yea = voting.yea.add(voterStake);
        else           voting.nay = voting.nay.add(voterStake);

        voting.voters[_voter] = _supports ? VoterState.Yea : VoterState.Nay;

        CastVote(_votingId, _voter, _supports);

        if (canExecute(_votingId)) _executeVote(_votingId);
    }

    function _executeVote(uint256 _votingId) internal {
        Voting storage voting = votings[_votingId];
        require(!voting.executed);

        voting.executed = true;
        voting.open = false;

        runScript(voting.executionScript);

        ExecuteVote(_votingId);
    }

    function pct(uint256 x, uint p) internal returns (uint256) {
        return x * p / PCT_BASE;
    }
}
