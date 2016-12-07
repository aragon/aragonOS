pragma solidity ^0.4.6;

import "./Vote.sol";
import "../AbstractCompany.sol";

contract BinaryVote is Vote {
  enum VoteOption {
    Favor,
    Against
  }

  function BinaryVote(string favor, string against) {
    addOption(uint8(VoteOption.Favor), favor);
    addOption(uint8(VoteOption.Against), against);
    lockVote();
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

contract IssueStockVote is BinaryVote("Approve issueing", "Reject") {
  uint8 stock;
  uint256 amount;

  function IssueStockVote(uint8 _stock, uint256 _amount) {
    stock = _stock;
    amount = _amount;
  }

  function executeOnAppove(AbstractCompany company) {
    company.issueStock(stock, amount);
  }
}
