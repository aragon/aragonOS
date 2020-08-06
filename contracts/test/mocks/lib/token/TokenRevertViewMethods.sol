// Modified from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/a9f910d34f0ab33a1ae5e714f69f9596a02b4d91/contracts/token/ERC20/StandardToken.sol

pragma solidity 0.4.24;

import "../../../../lib/math/SafeMath.sol";


contract TokenRevertViewMethods {
    using SafeMath for uint256;
    mapping (address => uint256) private balances;
    mapping (address => mapping (address => uint256)) private allowed;
    uint256 private totalSupply_;
    bool private allowTransfer_;

    // Allow us to set the inital balance for an account on construction
    constructor(address initialAccount, uint256 initialBalance) public {
        balances[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
        allowTransfer_ = true;
    }

    function totalSupply() public view returns (uint256) {
        require(false, "MOCK_ERROR");
        return totalSupply_;
    }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) public view returns (uint256) {
        require(false, "MOCK_ERROR");
        return balances[_owner];
    }

    /**
    * @dev Function to check the amount of tokens that an owner allowed to a spender.
    * @param _owner address The address which owns the funds.
    * @param _spender address The address which will spend the funds.
    * @return A uint256 specifying the amount of tokens still available for the spender.
    */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        require(false, "MOCK_ERROR");
        return allowed[_owner][_spender];
    }
}
