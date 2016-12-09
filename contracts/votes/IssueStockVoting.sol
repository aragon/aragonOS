pragma solidity ^0.4.6;

import "./BinaryVoting.sol";

contract IssueStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 stock;
  uint256 amount;

  function IssueStockVoting(uint8 _stock, uint256 _amount, uint8 _percentage, string _description) {
    stock = _stock;
    amount = _amount;

    // Metadata
    title = "Stock issue";
    description = _description;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) {
    company.issueStock(stock, amount);
  }
}
