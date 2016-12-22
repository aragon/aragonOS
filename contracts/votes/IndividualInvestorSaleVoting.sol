pragma solidity ^0.4.6;

import "./BinaryVoting.sol";
import "../sales/IndividualInvestorSale.sol";

contract IndividualInvestorSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  uint8 public stock;
  uint256 public units;
  uint256 public price;
  address public investor;
  uint64 public closeDate;
  string public title;

  function IndividualInvestorSaleVoting(uint8 _stock, address _investor, uint256 _units, uint256 _price, uint64 _closeDate, string _title, uint8 _percentage) {
    stock = _stock;
    units = _units;
    investor = _investor;
    price = _price;
    closeDate = _closeDate;
    title = _title;
    // Metadata
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    IndividualInvestorSale sale = new IndividualInvestorSale(company, stock, investor, units, price, closeDate, title);
    company.beginSale(address(sale));
    super.executeOnAppove(company);
  }
}
