pragma solidity ^0.4.6;

import "./BinaryVoting.sol";

contract StockSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  string public title;
  address public sale;

  function StockSaleVoting(address _sale, string _title, uint8 _percentage) {
    sale = _sale;

    // Metadata
    title = _title;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.beginSale(sale);
    super.executeOnAppove(company);
  }
}
