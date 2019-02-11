// Standards compliant token that is returns false instead of reverting for
// `transfer()`, `transferFrom()`, and `approve().
// Modified from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/a9f910d34f0ab33a1ae5e714f69f9596a02b4d91/contracts/token/ERC20/StandardToken.sol

pragma solidity 0.4.24;


contract TokenReturnFalseMock {
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
    * @dev Function to check the amount of tokens that an owner allowed to a spender.
    * @param _owner address The address which owns the funds.
    * @param _spender address The address which will spend the funds.
    * @return A uint256 specifying the amount of tokens still available for the spender.
    */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }

    /**
    * @dev Set whether the token is transferable or not
    * @param _allowTransfer Should token be transferable
    */
    function setAllowTransfer(bool _allowTransfer) public {
        allowTransfer_ = _allowTransfer;
    }

    /**
    * @dev Transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        if (!allowTransfer_ || _to == address(0) || _value > balances[msg.sender]) {
            return false;
        }

        balances[msg.sender] = balances[msg.sender] - _value;
        balances[_to] = balances[_to] + _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
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
    function approve(address _spender, uint256 _value) public returns (bool) {
        // Assume we want to protect for the race condition
        if (allowed[msg.sender][_spender] != 0) {
            return false;
        }

        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param _from address The address which you want to send tokens from
    * @param _to address The address which you want to transfer to
    * @param _value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        if (!allowTransfer_ ||
            _to == address(0) ||
            _value > balances[_from] ||
            _value > allowed[_from][msg.sender]
        ) {
            return false;
        }

        balances[_from] = balances[_from] - _value;
        balances[_to] = balances[_to] + _value;
        allowed[_from][msg.sender] = allowed[_from][msg.sender] - _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}
