pragma solidity ^0.4.8;

import "zeppelin/payment/PullPayment.sol";
import "zeppelin/token/StandardToken.sol";
import "./TransferableToken.sol";

contract GovernanceToken is StandardToken, TransferableToken, PullPayment {
  function GovernanceToken(address _governingEntity) {
    governingEntity = _governingEntity;
  }

  function changeGoverningEntity(address _governingEntity) onlyGoverningEntity {
    governingEntity = _governingEntity;
  }

  modifier onlyGoverningEntity {
    if (msg.sender != governingEntity) throw;
    _;
  }

  function isShareholder(address holder) constant returns (bool) {
    return true;
  }

  function splitDividends() payable {
    /*
    uint256 valuePerToken = msg.value / totalSupply;
    for (uint i = 0; i < shareholderIndex; i++) {
      address shareholder = shareholders[i];
      asyncSend(shareholder, balances[shareholder] * valuePerToken);
    }
    */
  }

  function transferableTokens(address holder, uint64 time) constant public returns (uint256) {
    return min256(balanceOf(holder), super.transferableTokens(holder, time));
  }

  address public governingEntity;
  string public name;
  string public symbol;
  uint public votingPower;    // Multiplayers
  uint public economicRights;
}
