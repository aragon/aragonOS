pragma solidity ^0.4.6;

import "./BinaryVoting.sol";
import "../sales/IndividualInvestorSale.sol";

contract IndividualInvestorSaleVoting is BinaryVoting("Approve stock sale", "Reject") {
  uint8 stock;
  uint256 units;
  uint256 price;
  address investor;
  uint64 closeDate;

  function IndividualInvestorSaleVoting(uint8 _stock, address _investor, uint256 _units, uint256 _price, uint64 _closeDate, uint8 _percentage, string _description, string _title) {
    stock = _stock;
    units = _units;
    investor = _investor;
    price = _price;
    closeDate = _closeDate;

    // Metadata
    title = _title;
    description = _description;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    IndividualInvestorSale sale = new IndividualInvestorSale(company, stock, investor, units, price, closeDate, title);
    company.beginSale(address(sale));
    super.executeOnAppove(company);
  }
}
