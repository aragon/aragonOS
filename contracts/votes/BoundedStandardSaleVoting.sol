pragma solidity ^0.4.6;

import "./BinaryVoting.sol";
import "../sales/BoundedStandardSale.sol";

contract BoundedStandardSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  uint8 public stock;
  uint256 public min;
  uint256 public max;
  uint256 public price;
  uint64 public closeDate;
  string public title;

  function BoundedStandardSaleVoting(uint8 _stock, uint256 _min, uint256 _max, uint256 _price, uint64 _closeDate, string _title, uint8 _percentage) {
    stock = _stock;
    min = _min;
    max = _max;
    price = _price;
    closeDate = _closeDate;

    // Metadata
    title = _title;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    BoundedStandardSale sale = new BoundedStandardSale(company, stock, min, max, price, closeDate, title);
    company.beginSale(address(sale));
    super.executeOnAppove(company);
  }
}
