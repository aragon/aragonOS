pragma solidity 0.4.15;

import "./EVMScriptRunner.sol";
import "../App.sol";

import "../../common/Initializable.sol";
import "../../common/MiniMeToken.sol";

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract VotingApp is App, Initializable, EVMScriptRunner {
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
        uint256 totalSupply;
        bytes executionScript;
        bool open;
        bool executed;

        mapping (address => VoterState) voters;
    }

    Voting[] votings;

    event StartVote(uint256 indexed votingId);
    event CastVote(uint256 indexed votingId, address indexed voter, bool supports);
    event ExecuteVote(uint256 indexed votingId);

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

    function newVoting(bytes _executionScript) auth {
        uint256 votingId = votings.length++;
        Voting storage voting = votings[votingId];
        voting.executionScript = _executionScript;
        voting.creator = msg.sender;
        voting.startDate = uint64(now);
        voting.open = true;
        voting.snapshotBlock = getBlockNumber() - 1; // avoid double voting in this very block
        voting.totalSupply = token.totalSupplyAt(voting.snapshotBlock);

        StartVote(votingId);

        if (canVote(votingId, msg.sender)) _vote(votingId, true, msg.sender);
    }

    function vote(uint256 _votingId, bool _supports) external {
        require(canVote(_votingId, msg.sender));

        _vote(_votingId, _supports, msg.sender);
    }

    function executeVote(uint256 _votingId) external {
        require(canExecute(_votingId));
        _executeVote(_votingId);
    }

    function canVote(uint256 _votingId, address _voter) constant returns (bool) {
        Voting storage voting = votings[_votingId];

        return voting.open &&
               uint64(now) < voting.startDate + voteTime &&
               token.balanceOfAt(_voter, voting.snapshotBlock) > 0;
    }

    function canExecute(uint256 _votingId) constant returns (bool) {
        Voting storage voting = votings[_votingId];

        // Voting is already decided
        if (voting.yea >= pct(voting.totalSupply, supportRequiredPct))
            return true;

        uint256 totalVotes = voting.yea + voting.nay;
        if (uint64(now) >= voting.startDate + voteTime &&
            voting.yea >= pct(totalVotes, supportRequiredPct) &&
            voting.yea >= pct(voting.totalSupply, minAcceptQuorumPct))
            return true;

        return false;
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
