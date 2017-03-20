pragma solidity ^0.4.8;

import "zeppelin/payment/PullPayment.sol";
import "zeppelin/token/StandardToken.sol";
import "./TransferableToken.sol";
import "../AbstractCompany.sol";

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

  function isVoter(address holder) constant returns (bool) {
    return votingPowerForDelegate(holder) > 0;
  }

  function hasVotedInOpenedVoting(address holder) constant public returns (bool) {
    return AbstractCompany(governingEntity).hasVotedInOpenedVoting(holder);
  }

  function transferableTokens(address holder, uint64 time) constant public returns (uint256) {
    return min256(hasVotedInOpenedVoting(holder) ? 0 : balanceOf(holder), super.transferableTokens(holder, time));
  }

  function votingDelegate(address holder) constant returns (address) {
    return delegates[holder] == 0x0 ? holder : delegates[holder];
  }

  function votingPowerForDelegate(address delegate) constant returns (uint256) {
    return delegatedVotes[delegate];
  }

  function setDelegate(address newDelegate) {
    setDelegate(msg.sender, newDelegate);
  }

  function setDelegate(address delegator, address newDelegate) internal {
    if (votingPowerForDelegate(delegator) > balanceOf(delegator)) throw;
    if (publicDelegate[newDelegate] == false && newDelegate != delegator) throw;

    balanceDelegateVotes(delegator, newDelegate, balanceOf(delegator));
    delegates[delegator] = newDelegate;
    if (votingDelegate(newDelegate) != newDelegate) throw; // check new delegate is not delegated
  }

  function setIsPublicDelegate(bool enable) {
    if (!enable && votingPowerForDelegate(msg.sender) > balanceOf(msg.sender)) throw; // Can't kick ppl out
    publicDelegate[msg.sender] = enable;
  }

  function balanceDelegateVotes(address _from, address _to, uint _value) private {
    delegatedVotes[votingDelegate(_from)] = safeSub(delegatedVotes[votingDelegate(_from)], _value);
    delegatedVotes[votingDelegate(_to)] = safeAdd(delegatedVotes[votingDelegate(_to)], _value);
  }

  function transfer(address _to, uint _value) canTransfer(msg.sender, _value) returns (bool success) {
    balanceDelegateVotes(msg.sender, _to, _value);
    return super.transfer(_to, _value);
  }

  function transferFrom(address _from, address _to, uint _value) canTransfer(_from, _value) returns (bool success) {
    balanceDelegateVotes(_from, _to, _value);
    return super.transferFrom(_from, _to, _value);
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

  mapping (address => address) delegates;
  mapping (address => uint256) delegatedVotes;
  mapping (address => bool) publicDelegate;

  address public governingEntity;
  string public name;
  string public symbol;
  uint public votingPower;    // Multiplayers
  uint public economicRights;
}
