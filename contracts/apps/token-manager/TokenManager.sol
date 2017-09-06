pragma solidity 0.4.15;

import "../App.sol";

import "../../common/MiniMeToken.sol";

import "zeppelin-solidity/contracts/token/ERC20.sol";

contract TokenManagerApp is App, Initializable, TokenController {
    MiniMeToken token;
    ERC20 wrappedToken;

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

    function assign(address _receiver, uint256 _amount) auth external {
        assert(token.transfer(_receiver, _amount));
    }

    function wrap(uint256 _amount) onlyWrapper external {
        assert(wrappedToken.transferFrom(msg.sender, address(this), _amount));
        _mint(msg.sender, _amount);
    }

    function unwrap(uint256 _amount) onlyWrapper external {
        assert(token.transferFrom(msg.sender, address(this), _amount)); // so it checks transferability. doesnt need approval as we are controller
        _burn(_amount);
        assert(wrappedToken.transfer(msg.sender, _amount));
    }

    function _burn(uint256 _amount) internal {
        assert(token.destroyTokens(address(this), _amount));
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
        return true;
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
        return true;
    }
}
