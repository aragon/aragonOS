pragma solidity ^0.4.6;

import "./BinaryVoting.sol";
import "../sales/BoundedStandardSale.sol";

contract BoundedStandardSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  uint8 stock;
  uint256 min;
  uint256 max;
  uint256 price;
  uint64 closeDate;

  function BoundedStandardSaleVoting(uint8 _stock, uint256 _min, uint256 _max, uint256 _price, uint64 _closeDate, uint8 _percentage, string _description, string _title) {
    stock = _stock;
    min = _min;
    max = _max;
    price = _price;
    closeDate = _closeDate;

    // Metadata
    title = _title;
    description = _description;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    BoundedStandardSale sale = new BoundedStandardSale(company, stock, min, max, price, closeDate, title);
    company.beginSale(address(sale));
    super.executeOnAppove(company);
  }
}
