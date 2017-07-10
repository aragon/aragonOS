pragma solidity ^0.4.8;

import "./BinaryVoting.sol";
import "../ICompany.sol";

contract BinaryPoll is BinaryVoting("Yes", "No") {
  string public description;
  function BinaryPoll(string _description) {
    description = _description;
  }

  function executeOnAppove(ICompany company) internal {}
}
