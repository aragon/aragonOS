pragma solidity ^0.4.11;

import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";


contract EtherToken is StandardToken {
    using SafeMath for uint256;

    string public name = "Ether";
    string public symbol = "ETH";
    uint8 public decimals = 18;

    function wrap() payable {
        totalSupply = totalSupply.add(msg.value);
        balances[msg.sender] = balances[msg.sender].add(msg.value);

        Mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount, address recipient) {
        performWithdrawAccounting(amount, recipient);

        recipient.transfer(amount);
    }

    // Withdraw without the oportunity of re-entrancy on the ETH transfer.
    // Credits to Jordi Baylina (https://gist.github.com/jbaylina/e8ac19b8e7478fd10cf0363ad1a5a4b3)
    function secureWithdraw(uint256 amount, address recipient) {
        performWithdrawAccounting(amount, recipient);

        assert(address(this).balance >= amount);
        address payContract;
        assembly {
            // Create a very basic contract that will send ether to the recipient by
            // self-destructing on constructor, which removes the oportunity for re-entrancy.
            // We basically code that very basic contract inline.
            let contractCode := mload(0x40)   // Find empty storage location using "free memory pointer"
            mstore8(contractCode, 0x7f)       // PUSH32
            mstore(add(contractCode, 1), recipient)
            mstore8(add(contractCode, 0x21), 0xff) // SELFDESTRUCT
            payContract := create(amount, contractCode, 0x22)
        }
        assert(payContract != 0); // check that contract was correctly created
    }

    // Internal function with common logic executed in a withdraw
    function performWithdrawAccounting(uint256 amount, address recipient) internal {
        totalSupply = totalSupply.sub(amount);
        balances[msg.sender] = balances[msg.sender].sub(amount); // will throw if less than 0

        Burn(msg.sender, amount);
    }

    event Mint(address indexed actor, uint value);
    event Burn(address indexed actor, uint value);
}
