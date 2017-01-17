pragma solidity ^0.4.8;

import "./BinaryVoting.sol";

contract IssueStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 public stock;
  uint256 public amount;

  function IssueStockVoting(uint8 _stock, uint256 _amount) {
    stock = _stock;
    amount = _amount;

    mainSignature = "issueStock(uint8,uint256)";
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.issueStock(stock, amount);
    super.executeOnAppove(company);
  }
}
