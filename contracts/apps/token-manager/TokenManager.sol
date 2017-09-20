pragma solidity 0.4.15;

import "../App.sol";

import "../../common/MiniMeToken.sol";
import "../../common/IForwarder.sol";
import "../../common/EVMCallScript.sol";

import "../../zeppelin/token/ERC20.sol";
import "../../zeppelin/math/SafeMath.sol";

contract TokenManager is App, Initializable, TokenController, EVMCallScriptRunner, IForwarder {
    using SafeMath for uint256;

    MiniMeToken public token;
    ERC20 public wrappedToken;

    uint256 constant MAX_VESTINGS_PER_ADDRESS = 50;
    struct TokenVesting {
        uint256 amount;
        uint64 start;
        uint64 cliff;
        uint64 vesting;
        bool revokable;
    }

    mapping (address => TokenVesting[]) vestings;

    modifier onlyNative {
        require(address(wrappedToken) == 0);
        _;
    }

    modifier onlyWrapper {
        require(address(wrappedToken) > 0);
        _;
    }

    // Other token specific events can be watched on the token address directly (avoid duplication)
    event NewVesting(address indexed receiver, uint256 vestingId, uint256 amount);
    event RevokeVesting(address indexed receiver, uint256 vestingId);

    /**
    * @notice Initializes TokenManager (parameters won't be modifiable after being set)
    * @param _token MiniMeToken address for the managed token (token manager must be the token controller)
    * @param _wrappedToken Address of the token being wrapped (can get 1:1 token exchanged for managed token)
    */
    function initialize(MiniMeToken _token, ERC20 _wrappedToken) onlyInit {
        initialized();

        require(_token.controller() == address(this));

        token = _token;
        wrappedToken = _wrappedToken;
    }

    /**
    * @notice Mint `_amount` of tokens for `_receiver` (Can only be called on native token manager)
    * @param _receiver The address receiving the tokens
    * @param _amount Number of tokens minted
    */
    function mint(address _receiver, uint256 _amount) auth onlyNative external {
        _mint(_receiver, _amount);
    }

    /**
    * @notice Mint `_amount` of tokens for the token manager (Can only be called on native token manager)
    * @param _amount Number of tokens minted
    */
    function issue(uint256 _amount) auth onlyNative external {
        _mint(address(this), _amount);
    }

    /**
    * @notice Exchange `_amount` of wrappedToken for tokens (Can only be called on wrapped token manager)
    * @param _amount Number of tokens wrapped
    */
    function wrap(uint256 _amount) onlyWrapper external {
        assert(wrappedToken.transferFrom(msg.sender, address(this), _amount));
        _mint(msg.sender, _amount);
    }

    /**
    * @notice Exchange `_amount` of tokens for the wrapped token (Can only be called on wrapped token manager)
    * @param _amount Number of tokens unwrapped
    */
    function unwrap(uint256 _amount) onlyWrapper external {
        require(transferrableBalance(msg.sender, now) >= _amount);
        _burn(msg.sender, _amount);
        assert(wrappedToken.transfer(msg.sender, _amount));
    }

    /**
    * @notice Assign `_amount` of tokens for `_receiver` from Token Manager's holdings
    * @param _receiver The address receiving the tokens
    * @param _amount Number of tokens transfered
    */
    function assign(address _receiver, uint256 _amount) auth external {
        _assign(_receiver, _amount);
    }

    /**
    * @notice Assign `_amount` of tokens for `_receiver` from Token Manager's holdings with a `_revokable` revokable vesting starting `_start`, cliff on `_cliff` (first portion of tokens transferable) and vesting on `_vesting` (all tokens transferable)
    * @param _receiver The address receiving the tokens
    * @param _amount Number of tokens transfered
    * @param _start Date the vesting calculations start
    * @param _cliff Date when the initial proportional amount of tokens are transferable
    * @param _vesting Date when all tokens are transferable
    * @param _revokable Whether the vesting can be revoked by the token manager
    */
    function assignVested(address _receiver, uint256 _amount, uint64 _start, uint64 _cliff, uint64 _vesting, bool _revokable) auth external returns (uint256) {
        require(tokenGrantsCount(_receiver) < MAX_VESTINGS_PER_ADDRESS);

        require(_start <= _cliff && _cliff <= _vesting);

        TokenVesting memory tokenVesting = TokenVesting(_amount, _start, _cliff, _vesting, _revokable);
        uint256 vestingId = vestings[_receiver].push(tokenVesting) - 1;

        _assign(_receiver, _amount);

        NewVesting(_receiver, vestingId, _amount);

        return vestingId;
    }

    /**
    * @notice Revoke vesting `_vestingId` from `_holder` returning unvested tokens to Token Manager
    * @param _holder Address getting vesting revoked
    * @param _vestingId Numeric id of the vesting
    */
    function revokeVesting(address _holder, uint256 _vestingId) auth external {
        TokenVesting storage v = vestings[_holder][_vestingId];
        require(v.revokable);

        uint nonVested = calculateNonVestedTokens(v.amount, uint64(now), v.start, v.cliff, v.vesting);

        // To make vestingIds immutable over time, we just zero out the revoked vesting
        delete vestings[_holder][_vestingId];

        // transferFrom always works as controller
        // onTransfer hook always allows if transfering to token controller
        assert(token.transferFrom(_holder, address(this), nonVested));

        RevokeVesting(_holder, _vestingId);
    }

    /**
    * @dev IForwarder interface conformance. Forwards any token holder action.
    * @param _evmCallScript Start vote with script
    */
    function forward(bytes _evmCallScript) external {
        require(canForward(msg.sender, _evmCallScript));
        runScript(_evmCallScript);
    }

    function canForward(address _sender, bytes _evmCallScript) constant returns (bool) {
        _evmCallScript;
        return token.balanceOf(_sender) > 0;
    }

    function tokenGrantsCount(address _holder) constant returns (uint256) {
        return vestings[_holder].length;
    }

    function spendableBalanceOf(address _holder) constant returns (uint256) {
        return transferrableBalance(_holder, now);
    }

    function transferrableBalance(address _holder, uint256 _time) constant returns (uint256) {
        uint256 vs = tokenGrantsCount(_holder);
        uint256 totalNonTransferable = 0;

        for (uint256 i = 0; i < vs; i = i.add(1)) {
            TokenVesting storage v = vestings[_holder][i];
            uint nonTransferable = calculateNonVestedTokens(v.amount, uint64(_time), v.start, v.cliff, v.vesting);
            totalNonTransferable = totalNonTransferable.add(nonTransferable);
        }

        return token.balanceOf(_holder).sub(totalNonTransferable);
    }

    /**
    * @dev Calculate amount of non-vested tokens at a specifc time.
    * @param tokens uint256 The amount of tokens grantted.
    * @param time uint64 The time to be checked
    * @param start uint64 A time representing the begining of the grant
    * @param cliff uint64 The cliff period.
    * @param vesting uint64 The vesting period.
    * @return An uint256 representing the amount of non-vested tokensof a specif grant.
    *  transferableTokens
    *   |                         _/--------   vestedTokens rect
    *   |                       _/
    *   |                     _/
    *   |                   _/
    *   |                 _/
    *   |                /
    *   |              .|
    *   |            .  |
    *   |          .    |
    *   |        .      |
    *   |      .        |
    *   |    .          |
    *   +===+===========+---------+----------> time
    *      Start       Clift    Vesting
    */
    function calculateNonVestedTokens(
        uint256 tokens,
        uint256 time,
        uint256 start,
        uint256 cliff,
        uint256 vesting) private constant returns (uint256)
    {
        // Shortcuts for before cliff and after vesting cases.
        if (time >= vesting) return 0;
        if (time < cliff) return tokens;

        // Interpolate all vested tokens.
        // As before cliff the shortcut returns 0, we can use just calculate a value
        // in the vesting rect (as shown in above's figure)

        // vestedTokens = tokens * (time - start) / (vesting - start)
        uint256 vestedTokens =
            SafeMath.div(
                SafeMath.mul(
                    tokens,
                    SafeMath.sub(time, start)
                ),
                SafeMath.sub(vesting, start)
        );

        return tokens - vestedTokens;
    }

    function _assign(address _receiver, uint256 _amount) internal {
        assert(token.transfer(_receiver, _amount));
    }

    function _burn(address _holder, uint256 _amount) internal {
        assert(token.destroyTokens(_holder, _amount));
    }

    function _mint(address _receiver, uint256 _amount) internal {
        assert(token.generateTokens(_receiver, _amount));
    }

    /**
    * @notice Called when `_owner` sends ether to the MiniMe Token contract
    * @param _owner The address that sent the ether to create tokens
    * @return True if the ether is accepted, false for it to throw
    */
    function proxyPayment(address _owner) payable returns (bool) {
        revert();
        _owner;
        return false;
    }

    /*
    * @dev Notifies the controller about a token transfer allowing the
    *      controller to decide whether to allow it or react if desired
    * @param _from The origin of the transfer
    * @param _to The destination of the transfer
    * @param _amount The amount of the transfer
    * @return False if the controller does not authorize the transfer
    */
    function onTransfer(address _from, address _to, uint _amount) returns (bool) {
        return _from == address(this) || _to == address(this) || transferrableBalance(_from, now) >= _amount;
    }

    /**
    * @dev Notifies the controller about an approval allowing the
    * controller to react if desired
    * @param _owner The address that calls `approve()`
    * @param _spender The spender in the `approve()` call
    * @param _amount The amount in the `approve()` call
    * @return False if the controller does not authorize the approval
    */
    function onApprove(address _owner, address _spender, uint _amount) returns (bool) {
        _owner; _spender; _amount;
        return true;
    }
}
