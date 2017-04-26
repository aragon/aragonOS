pragma solidity ^0.4.8;

import "../../misc/Txid.sol";
import "../AbstractCompany.sol";

contract Voting is Txid {
  mapping (uint8 => string) public options;
  uint256 public optionsIndex;
  bool private allowsModification;
  address public creator;

  function Voting() {
    optionsIndex = 0;
    allowsModification = true;
    creator = msg.sender;
  }

  function lockVoting() {
    allowsModification = false;
  }

  function addOption(uint8 id, string option) {
    if (!allowsModification) throw;
    options[id] = option;
    optionsIndex += 1;
  }

  function votingSupport(address company) constant returns (uint256 support, uint256 base, bool closingRelativeMajority) {
    (support, base, closingRelativeMajority,) = AbstractCompany(company).getVotingBylaw(mainSignature());
  }

  function executeOnAction(uint8 option, AbstractCompany company);
  function mainSignature() public constant returns (bytes4);
}
