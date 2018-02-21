pragma solidity ^0.4.18;

import "../lib/erc677/ERC677Token.sol";


contract EtherToken is ERC677Token {
    using SafeMath for uint256;

    string public name = "Ether";
    string public symbol = "ETH";
    uint8 public decimals = 18;

    function wrap() payable public {
        _wrap(msg.sender, msg.value);
    }

    function wrapAndCall(address _receiver, bytes _data) payable public {
        _wrap(_receiver, msg.value);
        _postTransferCall(_receiver, msg.value, _data);
    }

    function unwrap() public {
        withdraw(msg.sender, balances[msg.sender]);
    }

    function withdraw(address _recipient, uint256 _amount) public {
        require(_amount > 0);
        require(balances[msg.sender] >= _amount);

        totalSupply_ = totalSupply_.sub(_amount);
        balances[msg.sender] = balances[msg.sender].sub(_amount); // fails if no balance

        Burn(msg.sender, _amount);
        Transfer(msg.sender, 0, _amount);

        _recipient.transfer(_amount);
    }

    function _wrap(address _beneficiary, uint256 _amount) internal {
        require(_amount > 0);

        totalSupply_ = totalSupply_.add(_amount);
        balances[_beneficiary] = balances[_beneficiary].add(_amount);

        Mint(_beneficiary, _amount);
        Transfer(0, _beneficiary, _amount);
    }

    event Mint(address indexed actor, uint value);
    event Burn(address indexed actor, uint value);
}
