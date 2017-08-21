pragma solidity ^0.4.13;

/**
* @author Jorge Izquierdo (Aragon)
* @description VotingApp allows for very simple (binary votes) and light voting.
* It depends on an OwnershipType interface that provides all tokens an organization has
* and requires these tokens to be MiniMe to get token balances at a given block.
*/

import "../../tokens/MiniMeToken.sol";
import "../../kernel/Kernel.sol";
import "../ownership/OwnershipApp.sol";
import "../Application.sol";
import "../../misc/CodeHelper.sol";

import "./IVote.sol";
import "./IVotingApp.sol";

contract VotingApp is IVotingApp, Application, CodeHelper {
    // hash(bytecode) -> bool. Is the hash of some bytecode approved voting code?
    mapping (bytes32 => bool) public validVoteCode;

    // states a certain vote goes through
    enum VoteState {
        Debate,
        Voting,
        Closed,
        Executed
    }

    struct Vote {
        VoteState state;

        address voteCreator;
        address voteAddress;
        uint64 voteCreatedBlock;
        uint64 voteStartsBlock;
        uint64 voteEndsBlock;

        address[] governanceTokens;
        uint128[] votingWeights;
        uint256 totalQuorum;

        uint256 yays;
        uint256 nays;
        mapping (address => uint) voted; // 1 for yay, 2 for nay
    }

    Vote[] votes;  // array for storage of all votes
    mapping (address => uint) voteForAddress; // reverse index to quickly get the voteId for a vote address

    function VotingApp(address daoAddr)
    Application(daoAddr)
    {
        // init is automatically called by setDAO
    }

    function init() internal {
        assert(votes.length == 0); // asserts init can only be called once
        votes.length++; // index 0 is empty
    }

    function appId() constant returns (string) {
        return "voting.aragonpm.eth";
    }

    function version() constant returns (string) {
        return "1.0.0";
    }

    /**
    * @notice Create a new vote for `IVote(_voteAddress).data()`
    * @param _voteAddress the address of the contract that will be executed on approval
    * @param _voteStartsBlock block number in which voting can start (inclusive)
    * @param _voteEndsBlock block number in which voting ended (non-inclusive, voting on this block number is not allowed)
    */
    function createVote(address _voteAddress, uint64 _voteStartsBlock, uint64 _voteEndsBlock) onlyDAO external {
        uint voteId = votes.length;
        votes.length++;

        require(getBlockNumber() <= _voteStartsBlock && _voteStartsBlock < _voteEndsBlock); // block number integrity
        require(isVoteCodeValid(_voteAddress));     // check vote has allowed bytecode before creating it (it can change during voting)
        require(voteForAddress[_voteAddress] == 0); // not allow 2 votings with the same address

        Vote storage vote = votes[voteId];
        vote.voteCreator = dao_msg().sender;
        vote.voteAddress = _voteAddress;
        vote.voteCreatedBlock = getBlockNumber();
        vote.voteStartsBlock = _voteStartsBlock;
        vote.voteEndsBlock = _voteEndsBlock;
        voteForAddress[_voteAddress] = voteId;

        VoteCreated(voteId, _voteAddress);
        transitionStateIfChanged(voteId); // vote can start in this block
    }

    /**
    * @notice Vote positively in voting with id `_voteId`
    * @dev Function can be called directly without going through the DAO (save gas and bylaw is not useful for voting)
    * @param _voteId id for vote
    */
    function voteYay(uint _voteId) public {
        vote(_voteId, true, getSender());
    }

    /**
    * @notice Vote positively in voting with id `_voteId` and execute the vote result (will fail if not approved)
    * @dev Function can be called directly without going through the DAO (save gas and bylaw is not useful for voting)
    * @param _voteId id for vote
    */
    function voteYayAndExecute(uint _voteId) external {
        voteYay(_voteId);
        IVote(votes[_voteId].voteAddress).execute();
        transitionStateIfChanged(_voteId);
    }

    /**
    * @notice Vote negatively in voting with id `_voteId`
    * @dev Function can be called directly without going through the DAO (save gas and bylaw is not useful for voting)
    * @param _voteId id for vote
    */
    function voteNay(uint _voteId) external {
        vote(_voteId, false, getSender());
    }

    /**
    * @notice Make the hash `_codeHash` as `_valid ? 'valid' : 'invalid'` vote code
    * @dev Only voting contracts with accepted code hashes will be allowed (solves voting reentrancy as only trusted vote code that is executed once should be allowed)
    * @param _codeHash sha3 hash of the bytecode (stored in the blockchain, not the init_code)
    * @param _valid whether to whitelist it the code or not
    */
    function setValidVoteCode(bytes32 _codeHash, bool _valid) onlyDAO external {
        require(_codeHash > 0);
        validVoteCode[_codeHash] = _valid;
    }

    /**
    * @notice Force a state update for vote id `_voteId`
    * @dev Sometimes state transitions for votes have to be triggered from the outside (for closed and executed stages)
    * @param _voteId id for vote checked
    */
    function transitionStateIfChanged(uint _voteId) public {
        Vote storage vote = votes[_voteId];

        // Multiple state transitions can happen at once
        if (vote.state == VoteState.Debate && getBlockNumber() >= vote.voteStartsBlock) {
            transitionToVotingState(vote);
            VoteStateChanged(_voteId, uint(VoteState.Debate), uint(VoteState.Voting));
        }

        bool voteWasExecuted = IVote(votes[_voteId].voteAddress).wasExecuted();

        if (vote.state == VoteState.Voting && (voteWasExecuted || getBlockNumber() > vote.voteEndsBlock || vote.governanceTokens.length == 0 || vote.totalQuorum == 0)) {
            vote.state = VoteState.Closed;
            VoteStateChanged(_voteId, uint(VoteState.Voting), uint(VoteState.Closed));
        }

        if (vote.state == VoteState.Closed && voteWasExecuted) {
            vote.state = VoteState.Executed;
            VoteStateChanged(_voteId, uint(VoteState.Closed), uint(VoteState.Executed));
        }
    }

    /**
    * @dev Function called from other components to check whether a vote is approved given certain parameters. All must pass.
    * @param _voteAddress the address of the vote being checked
    * @param _supportPct was voted positively by this percentage of voting quorum
    * @param _minQuorumPct is the quorum at least this percentage
    * @param _minDebateTime was there at least this many blocks between creation and voting starting
    * @param _minVotingTime was there at least this many blocks between voting starting and closing
    */
    function isVoteApproved(
        address _voteAddress,
        uint256 _supportPct,
        uint256 _minQuorumPct,
        uint64 _minDebateTime,
        uint64 _minVotingTime
    ) constant returns (bool)
    {
        uint voteId = voteForAddress[_voteAddress];
        if (voteId == 0)
            return false;

        Vote storage vote = votes[voteId];

        if (vote.state == VoteState.Debate || vote.totalQuorum == 0)
            return false;
        if (vote.voteStartsBlock - vote.voteCreatedBlock < _minDebateTime)
            return false;
        if (vote.voteEndsBlock - vote.voteStartsBlock < _minVotingTime)
            return false;
        if (!isVoteCodeValid(vote.voteAddress))
            return false;

        // After the vote has ended check whether min quorum was met and voting quorum approved it
        if (getBlockNumber() >= vote.voteEndsBlock) {
            uint256 quorum = vote.yays + vote.nays;
            uint256 yaysQuorumPct = vote.yays * PCT_BASE / quorum;
            uint256 quorumPct = quorum * PCT_BASE / vote.totalQuorum;

            return yaysQuorumPct >= _supportPct && quorumPct >= _minQuorumPct;
        } else {
            // Before the voting has ended, absolute support is needed
            // (there is no way that the minSupport isn't met even if all remaining votes are negative)
            uint256 yaysTotalPct = vote.yays * PCT_BASE / vote.totalQuorum;

            return yaysTotalPct >= _supportPct;
        }
    }

    /**
    * @dev Gets status for a certain vote
    * @param _voteId id of the vote
    * @return all voting status
    */
    function getVoteStatus(uint _voteId) constant returns (uint state, address voteCreator, address voteAddress, uint64 voteCreatedBlock, uint64 voteStartsBlock, uint64 voteEndsBlock, uint256 yays, uint256 nays, uint256 totalQuorum, bool validCode) {
        Vote storage vote = votes[_voteId];
        state = uint(vote.state);
        voteCreator = vote.voteCreator;
        voteAddress = vote.voteAddress;
        voteCreatedBlock = vote.voteCreatedBlock;
        voteStartsBlock = vote.voteStartsBlock;
        voteEndsBlock = vote.voteEndsBlock;
        yays = vote.yays;
        nays = vote.nays;
        totalQuorum = vote.totalQuorum;
        validCode = isVoteCodeValid(vote.voteAddress);
    }

    /**
    * @dev Getter for whether the contract at `_addr` is valid
    * @param _addr contract address being checked
    * @return bool whether it is valid or not
    */
    function isVoteCodeValid(address _addr) constant returns (bool) {
        return validVoteCode[hashForCode(_addr)];
    }

    /**
    * @dev low level vote function. Gets the balances at the start block of the vote and adds votes according to weights
    * @param _voteId id for vote
    * @param _isYay whether to add a possitive or negative vote
    * @param _voter address of voter
    */
    function vote(uint _voteId, bool _isYay, address _voter)
    transitions_state(_voteId) only_state(_voteId, VoteState.Voting)
    internal
    {
        Vote storage vote = votes[_voteId];
        uint tokenLength = vote.governanceTokens.length;

        uint totalStake = 0;
        for (uint i = 0; i < tokenLength; i++) {
            uint balance = MiniMeToken(vote.governanceTokens[i]).balanceOfAt(_voter, vote.voteStartsBlock);
            totalStake += balance * vote.votingWeights[i];
        }

        if (vote.voted[_voter] > 0) {  // already voted
            bool votedYay = vote.voted[_voter] == 1;

            if (votedYay)
                vote.yays -= totalStake;
            else
                vote.nays -= totalStake;
        }

        if (_isYay)
            vote.yays += totalStake;
        else
            vote.nays += totalStake;

        vote.voted[_voter] = _isYay ? 1 : 2;

        VoteCasted(
            _voteId,
            _voter,
            _isYay,
            totalStake
        );
    }

    function transitionToVotingState(Vote storage vote) internal {
        vote.state = VoteState.Voting;
        OwnershipApp ownershipApp = getOwnershipApp();

        uint count = ownershipApp.getTokenCount();
        for (uint i = 1; i <= count; i++) {
            var (tokenAddress, governanceRights,) = ownershipApp.getToken(i);
            if (governanceRights > 0) {
                vote.governanceTokens.push(tokenAddress);
                vote.votingWeights.push(governanceRights);
                uint tokenSupply = MiniMeToken(tokenAddress).totalSupplyAt(vote.voteStartsBlock);
                vote.totalQuorum += governanceRights * (tokenSupply - MiniMeToken(tokenAddress).balanceOfAt(dao, vote.voteStartsBlock));
            }
        }

        assert(vote.votingWeights.length == vote.governanceTokens.length);
    }

    function getOwnershipApp() internal returns (OwnershipApp) {
        return OwnershipApp(dao);
    }

    // @dev just for mocking purposes
    function getBlockNumber() internal returns (uint64) {
        return uint64(block.number);
    }

    modifier transitions_state(uint voteId) {
        transitionStateIfChanged(voteId);
        _;
        transitionStateIfChanged(voteId);
    }

    modifier only_state(uint voteId, VoteState state) {
        require(votes[voteId].state == state);
        _;
    }

    uint constant PCT_BASE = 10 ** 18;
}
