// Non-standards compliant token that is missing return values for
// `transfer()`, `transferFrom()`, and `approve().
// Modified from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/a9f910d34f0ab33a1ae5e714f69f9596a02b4d91/contracts/token/ERC20/StandardToken.sol

pragma solidity 0.4.24;

import "../../../../lib/math/SafeMath.sol";


contract TokenReturnMissingMock {
    using SafeMath for uint256;
    mapping (address => uint256) private balances;
    mapping (address => mapping (address => uint256)) private allowed;
    uint256 private totalSupply_;
    bool private allowTransfer_;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Allow us to set the inital balance for an account on construction
    constructor(address initialAccount, uint256 initialBalance) public {
        balances[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
        allowTransfer_ = true;
    }

    function totalSupply() public view returns (uint256) { return totalSupply_; }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

    /**
    * @dev Set whether the token is transferable or not
    * @param _allowTransfer Should token be transferable
    */
    function setAllowTransfer(bool _allowTransfer) public {
        allowTransfer_ = _allowTransfer;
    }

    /**
    * @dev Function to check the amount of tokens that an owner allowed to a spender.
    * @param _owner address The address which owns the funds.
    * @param _spender address The address which will spend the funds.
    * @return A uint256 specifying the amount of tokens still available for the spender.
    */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }

    /**
    * @dev Transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public {
        require(allowTransfer_);
        require(_value <= balances[msg.sender]);
        require(_to != address(0));

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
    }

    /**
    * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
    * Beware that changing an allowance with this method brings the risk that someone may use both the old
    * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
    * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
    * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    * @param _spender The address which will spend the funds.
    * @param _value The amount of tokens to be spent.
    */
    function approve(address _spender, uint256 _value) public {
        // Assume we want to protect for the race condition
        require(allowed[msg.sender][_spender] == 0);

        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param _from address The address which you want to send tokens from
    * @param _to address The address which you want to transfer to
    * @param _value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address _from, address _to, uint256 _value) public {
        require(allowTransfer_);
        require(_value <= balances[_from]);
        require(_value <= allowed[_from][msg.sender]);
        require(_to != address(0));

        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        emit Transfer(_from, _to, _value);
    }
}
