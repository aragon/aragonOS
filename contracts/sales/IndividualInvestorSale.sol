pragma solidity ^0.4.6;

import "./StockSale.sol";

contract IndividualInvestorSale is StockSale("IndividualInvestorSale") {
  uint256 public units;
  uint256 public price;

  address public investor;

  bool settled;

  function IndividualInvestorSale(address _companyAddress, uint8 _stockId, address _investor, uint256 _units, uint256 _price, uint64 _closeDate, string _title) {
    companyAddress = _companyAddress;
    stockId = _stockId;

    price = _price;
    units = _units;
    closeDate = _closeDate;
    investor = _investor;
    saleTitle = _title;
  }

  function raiseMaximum() constant returns (uint256) {
    return units * price;
  }

  function raiseTarget() constant returns (uint256) {
    return units * price;
  }

  function buy(address holder) payable {
    if (holder != investor) throw;
    if (msg.value < units * getBuyingPrice(msg.value)) throw;
    if (!isBuyingAllowed(units)) throw;

    uint256 returningMoney = msg.value - (units * getBuyingPrice(msg.value));

    company().assignStock(stockId, investor, units);
    settled = true;
    raisedAmount += msg.value - returningMoney;
    buyers[holder] += units;

    StockBought(units, getBuyingPrice(msg.value));

    if (returningMoney > 0) {
      if (!holder.send(returningMoney)) { throw; }
    }
  }

  function isSellingAllowed(uint256 amount) constant returns (bool) { return false; }
  function sell() { throw; }

  function isFundsTransferAllowed() constant returns (bool) {
    return settled;
  }

  function getBuyingPrice(uint256 amount) constant returns (uint256) {
    return price;
  }

  function getSellingPrice(uint256 amount) constant returns (uint256) {
    return 0;
  }

  function availableTokens() constant returns (uint256) {
    return settled ? 0 : units;
  }

  function isBuyingAllowed(uint256 amount) constant returns (bool) {
    return !settled && availableTokens() == amount && now <= closeDate;
  }

}
