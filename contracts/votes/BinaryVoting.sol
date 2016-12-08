pragma solidity ^0.4.6;

import "./Voting.sol";
import "../AbstractCompany.sol";

contract BinaryVoting is Voting {
  enum VotingOption {
    Favor,
    Against
  }

  function BinaryVoting(string favor, string against) {
    addOption(uint8(VotingOption.Favor), favor);
    addOption(uint8(VotingOption.Against), against);
    lockVoting();
  }

  function executeOnAction(uint8 option, AbstractCompany company) {
    if (option == 0) return executeOnAppove(company);
    if (option == 1) return executeOnReject(company);
  }

  function executeOnReject(AbstractCompany company) {
    suicide(address(company));
  }

  function executeOnAppove(AbstractCompany company);
}

contract IssueStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 stock;
  uint256 amount;

  function IssueStockVoting(uint8 _stock, uint256 _amount) {
    stock = _stock;
    amount = _amount;
  }

  function executeOnAppove(AbstractCompany company) {
    company.issueStock(stock, amount);
  }
}
