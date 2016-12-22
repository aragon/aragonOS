pragma solidity ^0.4.6;

import "./BinaryVoting.sol";

contract IssueStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 public stock;
  uint256 public amount;

  function IssueStockVoting(uint8 _stock, uint256 _amount, uint8 _percentage) {
    stock = _stock;
    amount = _amount;

    // Metadata
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.issueStock(stock, amount);
    super.executeOnAppove(company);
  }
}
