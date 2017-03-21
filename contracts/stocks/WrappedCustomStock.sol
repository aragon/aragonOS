pragma solidity ^0.4.8;

import "./GovernanceToken.sol";
import "./WrappedToken.sol";

contract WrappedCustomStock is GovernanceToken, WrappedToken {
  function WrappedCustomStock(address _company, address _parentToken, string _name, string _symbol, uint8 _votingPower, uint8 _economicRights)
           GovernanceToken(_company)
           WrappedToken(_parentToken) {

    votingPower = _votingPower;
    economicRights = _economicRights;
    name = _name;
    symbol = _symbol;
  }
}
