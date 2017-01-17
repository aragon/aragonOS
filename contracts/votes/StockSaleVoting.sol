pragma solidity ^0.4.8;

import "./BinaryVoting.sol";

contract StockSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  string public title;
  address public sale;

  function StockSaleVoting(address _sale, string _title) {
    sale = _sale;

    // Metadata
    title = _title;
    mainSignature = "beginSale(address)";
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.beginSale(sale);
    super.executeOnAppove(company);
  }
}
