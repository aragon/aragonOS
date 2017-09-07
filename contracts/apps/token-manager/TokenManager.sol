pragma solidity 0.4.15;

import "../App.sol";

import "../../common/MiniMeToken.sol";

import "zeppelin-solidity/contracts/token/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TokenManager is App, Initializable, TokenController {
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

    function initialize(MiniMeToken _token, ERC20 _wrappedToken) onlyInit {
        initialized();

        require(_token.controller() == address(this));

        token = _token;
        wrappedToken = _wrappedToken;
    }

    function mint(address _receiver, uint256 _amount) auth onlyNative external {
        _mint(_receiver, _amount);
    }

    function issue(uint256 _amount) auth onlyNative external {
        _mint(address(this), _amount);
    }

    function wrap(uint256 _amount) onlyWrapper external {
        assert(wrappedToken.transferFrom(msg.sender, address(this), _amount));
        _mint(msg.sender, _amount);
    }

    function unwrap(uint256 _amount) onlyWrapper external {
        require(transferrableBalance(msg.sender) >= _amount);
        _burn(msg.sender, _amount);
        assert(wrappedToken.transfer(msg.sender, _amount));
    }

    function assign(address _receiver, uint256 _amount) auth external {
        _assign(_receiver, _amount);
    }

    function assignVested(address _receiver, uint256 _amount, uint64 _start, uint64 _cliff, uint64 _vesting, bool _revokable) auth external returns (uint256) {
        require(tokenGrantsCount(_receiver) < MAX_VESTINGS_PER_ADDRESS);

        require(_start <= _cliff && _cliff <= _vesting);

        TokenVesting memory tokenVesting = TokenVesting(_amount, _start, _cliff, _vesting, _revokable);
        uint256 vestingId = vestings[_receiver].push(tokenVesting) - 1;

        _assign(_receiver, _amount);

        return vestingId;
    }

    function revokeVesting(address _holder, uint256 _vestingId) auth external {
        TokenVesting storage v = vestings[_holder][_vestingId];
        require(v.revokable);

        uint nonVested = calculateNonVestedTokens(v.amount, uint64(now), v.start, v.cliff, v.vesting);

        // To make vestingIds  immutable over time, we just zero out the revoked vesting
        delete vestings[_holder][_vestingId];

        // transferFrom always works as controller
        // onTransfer hook always allows if transfering to token controller
        assert(token.transferFrom(_holder, address(this), nonVested));
    }

    function tokenGrantsCount(address _holder) constant returns (uint256) {
        return vestings[_holder].length;
    }

    function transferrableBalance(address _holder) constant returns (uint256) {
        uint256 vs = tokenGrantsCount(_holder);
        uint256 totalNonTransferable = 0;

        for (uint256 i = 0; i < vs; i = i.add(1)) {
            TokenVesting storage v = vestings[_holder][i];
            uint nonTransferable = calculateNonVestedTokens(v.amount, uint64(now), v.start, v.cliff, v.vesting);
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
        return _from == address(this) || _to == address(this) || transferrableBalance(_from) >= _amount;
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
