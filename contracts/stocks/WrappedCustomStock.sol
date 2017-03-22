pragma solidity ^0.4.8;

import "./GovernanceToken.sol";
import "./WrappedToken.sol";

contract WrappedCustomStock is WrappedToken, GovernanceToken {
  function WrappedCustomStock(address _company, address _parentToken, string _name, string _symbol, uint8 _votingPower, uint8 _economicRights)
           WrappedToken(_parentToken) GovernanceToken(_company) {
    votingPower = _votingPower;
    economicRights = _economicRights;
    name = _name;
    symbol = _symbol;
  }

  function wrap(uint256 wrappingAmount) {
    super.wrap(wrappingAmount);
    balanceDelegateVotes(0x0, msg.sender, wrappingAmount);
  }

  function unwrapAndTransfer(address receiver, uint amount) {
    super.unwrapAndTransfer(receiver, amount);
    balanceDelegateVotes(msg.sender, 0x0, amount); // remove from owner in wrapper
  }
}
