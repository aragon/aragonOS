pragma solidity ^0.4.13;

/**
* @author Jorge Izquierdo (Aragon)
* @description BylawsApp is a simple permissions oracle for the DAO that supports
* actions integrating with default DAO apps
* It defines 6 bylaw types:
* 1) voting bylaw (depends on an app that implements IVotingOracle)
* 2) status bylaw (depends on an app that implements IStatusOracle)
* 3) token holder bylaw (depends on an app that implements ITokenHolderOracle)
* 4) address bylaw (only x address can perform action)
* 5) oracle bylaw (depends on address x implementing BylawOracle)
* 6) combinator bylaw (combines two bylaws of previous types with a logic operator)
*/

import "../Application.sol";

import "../status/StatusApp.sol";
import "../ownership/OwnershipApp.sol";
import "../basic-governance/IVotingApp.sol";

import "./BylawOracle.sol";
import "./IBylawsApp.sol";

contract BylawsApp is IBylawsApp, Application {
    enum BylawType { Voting, Status, TokenHolder, Address, Oracle, Combinator }
    enum CombinatorType { Or, And, Xor }

    struct Bylaw {
        BylawType bylawType;

        bool not; // reverse logic. makes bylaw pass if it was false

        // a bylaw can be one of these types
        uint8 status; // For status type
        address addr; // For address and oracle types
        VotingBylaw voting;
        CombinatorBylaw combinator;
    }

    struct VotingBylaw {
        uint256 supportPct;       // 16pct % * 10^16 (pe. 5% = 5 * 10^16)
        uint256 minQuorumPct;     // 16pct

        uint64 minDebateTime; // in blocks
        uint64 minVotingTime; // in blocks
    }

    struct CombinatorBylaw {
        CombinatorType combinatorType; // if TRUE combinator is AND, if false is an OR combinator
        uint256 leftBylawId;
        uint256 rightBylawId;
    }

    Bylaw[] bylaws;
    mapping (bytes4 => uint) public bylawEntrypoint;

    mapping (address => bool) public isTokenWhitelisted;

    uint constant PCT_BASE = 10 ** 18;

    function BylawsApp(address dao)
    Application(dao)
    {
    }

    function init() internal {
        var (id, bylaw) = newBylaw(); // so index is 1 for first legit bylaw
        assert(id == 0);

        // unassigned bylaws will use bylaw 0 as its own
        // by default allow calls from any non-zero address (aka every address)
        bylaw.bylawType = BylawType.Address;
        bylaw.addr = 0;
        bylaw.not = true;
    }

    function newBylaw() internal returns (uint id, Bylaw storage newBylaw) {
        id = bylaws.length;
        bylaws.length++;
        newBylaw = bylaws[id];
    }

    /**
    * @notice Set bylaw `_id` responsible for checking action `_sig`
    * @dev Links a signature entrypoint to a bylaw.
    * It is the only function that needs to be protected as onlyDAO
    * a nice side effect is that multiple actions can share the same bylaw
    * @param _sig Function signature being linked
    * @param _id Existing bylaw id
    */
    function linkBylaw(bytes4 _sig, uint _id)
    existing_bylaw(_id)
    onlyDAO
    external
    {
        bylawEntrypoint[_sig] = _id;

        BylawChanged(
            _sig,
            getBylawType(_id),
            _id,
            getSender()
        );
    }

    /**
    * @dev Change the whitelist status of a token
    * @ param token address The token to whitelist
    * @ _whitelist bool Desired status of token
    */
    function setTokenWhitelist(address token, bool _whitelist)
    onlyDAO
    public
    {
        isTokenWhitelisted[token] = _whitelist;
    }

    /**
    * @dev Implements Permissions Oracle compatibility so it can be called from Kernel
    * @param sender Sender of the action to the DAO
    * @param token Token from which the call originated (0 = ether call)
    * @param value Amount of tokens sent with the call
    * @param data Payload being executed in the call
    * @return bool indicates whether bylaws allow action or not
    */
    function canPerformAction(
        address sender,
        address token,
        uint256 value,
        bytes data
    ) constant returns (bool)
    {
        if (!isTokenWhitelisted[token] && token != 0)
            return false;


        return canPerformAction(
            getSig(data),
            sender,
            data,
            token,
            value
        );
    }

    /**
    * @notice Create `_isTokenHolderStatus ? 'token holder' : 'status'` bylaw
    * @param _statusNeeded integer representing status in org
    * @param _isTokenHolderStatus whether is normal integer status or token holder
    * @param _not whether to negate bylaw
    * @return uint bylaw id
    */
    function setStatusBylaw(uint8 _statusNeeded, bool _isTokenHolderStatus, bool _not) external returns (uint) {
        var (id, bylaw) = newBylaw();

        bylaw.bylawType = _isTokenHolderStatus ? BylawType.TokenHolder : BylawType.Status;
        bylaw.status = _statusNeeded;
        bylaw.not = _not;

        return id;
    }

    /**
    * @notice Create `_isOracle ? 'oracle' : 'address'` bylaw with `_addr`
    * @param _addr address allowed or oracle
    * @param _isOracle whether address is allowed or will be asked for permission (oracle)
    * @param _not whether to negate bylaw
    * @return uint bylaw id
    */
    function setAddressBylaw(address _addr, bool _isOracle, bool _not) external returns (uint) {
        var (id, bylaw) = newBylaw();

        bylaw.bylawType = _isOracle ? BylawType.Oracle : BylawType.Address;
        bylaw.addr = _addr;
        bylaw.not = _not;

        return id;
    }

    /**
    * @notice Create voting bylaw with `_supportPct / 10^18 * 100`%
    * @param _supportPct voted positively by this percentage of voting quorum
    * @param _minQuorumPct is the quorum at least this percentage
    * @param _minDebateTime was there at least this many blocks between creation and voting starting
    * @param _minVotingTime was there at least this many blocks between voting starting and closing
    * @param _not whether to negate bylaw
    * @return uint bylaw id
    */
    function setVotingBylaw(
        uint256 _supportPct,
        uint256 _minQuorumPct,
        uint64 _minDebateTime,
        uint64 _minVotingTime,
        bool _not
    ) external returns (uint) {
        var (id, bylaw) = newBylaw();

        require(_supportPct > 0 && _supportPct <= PCT_BASE); // dont allow weird cases

        bylaw.bylawType = BylawType.Voting;
        bylaw.voting.supportPct = _supportPct;
        bylaw.voting.minQuorumPct = _minQuorumPct;
        bylaw.voting.minDebateTime = _minDebateTime;
        bylaw.voting.minVotingTime = _minVotingTime;
        bylaw.not = _not;

        return id;
    }

    /**
    * @notice Create combinator bylaw of type `_combinatorType` between `_leftBylawId` and `_rightBylawId`
    * @param _combinatorType how the underlying bylaws are combined (0 = or, 1 = and, 2 = xor)
    * @param _leftBylawId first bylaw being checked
    * @param _rightBylawId second bylaw being checked
    * @param _not whether to negate bylaw
    * @return uint bylaw id
    */
    function setCombinatorBylaw(
        uint _combinatorType,
        uint _leftBylawId,
        uint _rightBylawId,
        bool _not
    )
    existing_bylaw(_leftBylawId)
    external returns (uint)
    {
        var (id, bylaw) = newBylaw();
        require(_leftBylawId != _rightBylawId && _rightBylawId > 0);

        bylaw.bylawType = BylawType.Combinator;
        bylaw.combinator.combinatorType = CombinatorType(_combinatorType);
        bylaw.combinator.leftBylawId = _leftBylawId;
        bylaw.combinator.rightBylawId = _rightBylawId;
        bylaw.not = _not;

        return id;
    }

    function getBylawType(uint bylawId) constant returns (uint) {
        return uint(bylaws[bylawId].bylawType);
    }

    function getBylawNot(uint bylawId) constant returns (bool) {
        return bylaws[bylawId].not;
    }

    function getStatusBylaw(uint256 bylawId) constant returns (uint) {
        return bylaws[bylawId].status;
    }

    function getAddressBylaw(uint256 bylawId) constant returns (address) {
        return bylaws[bylawId].addr;
    }

    function getVotingBylaw(uint256 bylawId) constant returns (uint256 supportPct, uint256 minQuorumPct, uint64 minDebateTime, uint64 minVotingTime) {
        Bylaw storage bylaw = bylaws[bylawId];

        supportPct = bylaw.voting.supportPct;
        minQuorumPct = bylaw.voting.minQuorumPct;
        minDebateTime = bylaw.voting.minDebateTime;
        minVotingTime = bylaw.voting.minVotingTime;
    }

    function getCombinatorBylaw(uint256 bylawId) constant returns (uint combinatorType, uint leftBylawId, uint rightBylawId) {
        Bylaw storage bylaw = bylaws[bylawId];

        combinatorType = uint(bylaw.combinator.combinatorType);
        leftBylawId = bylaw.combinator.leftBylawId;
        rightBylawId = bylaw.combinator.rightBylawId;
    }

    function canPerformAction(
        bytes4 sig,
        address sender,
        bytes data,
        address token,
        uint256 value
    ) internal returns (bool)
    {
        // by default if not linked, bylaw 0 will apply
        uint bylawId = bylawEntrypoint[sig];

        return canPerformAction(
            bylawId,
            sender,
            data,
            token,
            value
        );
    }

    function canPerformAction(
        uint bylawId,
        address sender,
        bytes data,
        address token,
        uint256 value
    ) internal returns (bool)
    {
        Bylaw storage bylaw = bylaws[bylawId];
        if (bylaw.bylawType == BylawType.TokenHolder) {
            return negateIfNeeded(isTokenHolder(sender), bylaw.not);
        }

        if (bylaw.bylawType == BylawType.Status) {
            return negateIfNeeded(getStatus(sender) >= bylaw.status, bylaw.not);
        }

        if (bylaw.bylawType == BylawType.Address) {
            return negateIfNeeded(sender == bylaw.addr, bylaw.not);
        }

        if (bylaw.bylawType == BylawType.Oracle) {
            var (canPerform,) = BylawOracle(bylaw.addr).canPerformAction(
                sender,
                data,
                token,
                value
            );
            return negateIfNeeded(canPerform, bylaw.not);
        }

        if (bylaw.bylawType == BylawType.Voting) {
            return negateIfNeeded(checkVoting(bylaw.voting, sender), bylaw.not);
        }

        if (bylaw.bylawType == BylawType.Combinator) {
            return negateIfNeeded(
                computeCombinatorBylaw(
                    bylaw,
                    sender,
                    data,
                    token,
                    value
                ),
                bylaw.not
            );
        }
    }

    function checkVoting(VotingBylaw votingBylaw, address voteAddress) internal returns (bool) {
        return getVotingOracle().isVoteApproved(
            voteAddress,
            votingBylaw.supportPct,
            votingBylaw.minQuorumPct,
            votingBylaw.minDebateTime,
            votingBylaw.minVotingTime
        );
    }

    function computeCombinatorBylaw(
        Bylaw storage bylaw,
        address sender,
        bytes data,
        address token,
        uint256 value
    ) internal returns (bool)
    {
        bool leftResult = canPerformAction(
            bylaw.combinator.leftBylawId,
            sender,
            data,
            token,
            value
        );

        // shortcuts
        if (leftResult && bylaw.combinator.combinatorType == CombinatorType.Or)
            return true;
        if (!leftResult && bylaw.combinator.combinatorType == CombinatorType.And)
            return false;

        bool rightResult = canPerformAction(
            bylaw.combinator.rightBylawId,
            sender,
            data,
            token,
            value
        );

        if (bylaw.combinator.combinatorType == CombinatorType.Xor) {
            return (leftResult && !rightResult) || (!leftResult && rightResult);
        } else {
            return rightResult;
        }
    }

    function isTokenHolder(address entity) internal returns (bool) {
        return getTokenHolderOracle().isHolder(entity);
    }

    function getStatus(address entity) internal returns (uint8) {
        return uint8(
            getStatusOracle()
            .getEntityStatus(entity)
        );
    }

    function negateIfNeeded(bool result, bool negate) internal returns (bool) {
        return negate ? !result : result;
    }

    function getTokenHolderOracle() internal returns (ITokenHolderOracle) {
        return ITokenHolderOracle(dao);
    }

    function getVotingOracle() internal returns (IVotingOracle) {
        return IVotingOracle(dao);
    }

    function getStatusOracle() internal returns (IStatusOracle) {
        return IStatusOracle(dao);
    }

    function getSig(bytes d) internal returns (bytes4 sig) {
        assembly { sig := mload(add(d, 0x20)) }
    }

    modifier existing_bylaw(uint bylawId) {
        require(bylawId > 0);
        require(bylawId < bylaws.length);
        _;
    }
}
