pragma solidity ^0.4.8;

import "./IssueableStock.sol";

contract CustomStock is IssueableStock {
  function CustomStock(address _company, string _name, string _symbol, uint8 _votingPower, uint8 _economicRights)
           GovernanceToken(_company) {
    votingPower = _votingPower;
    economicRights = _economicRights;
    name = _name;
    symbol = _symbol;
  }
}
