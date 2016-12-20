pragma solidity ^0.4.6;

import "./StockSale.sol";

contract BoundedStandardSale is StockSale("BoundedStandardSale") {
  uint256 public minUnits;
  uint256 public maxUnits;
  uint256 public price;
  uint64 public closeDate;

  mapping (address => uint256) buyers;

  function BoundedStandardSale(address _companyAddress, uint8 _stockId, uint256 _min, uint256 _max, uint256 _price, uint64 _closeDate, string _title) {
    companyAddress = _companyAddress;
    stockId = _stockId;

    minUnits = _min;
    maxUnits = _max;
    price = _price;
    closeDate = _closeDate;
    saleTitle = _title;
  }

  function availableTokens() constant returns (uint256) {
    return maxUnits - soldTokens;
  }

  function isBuyingAllowed(uint256 amount) constant returns (bool) {
    return availableTokens() > amount && now <= closeDate;
  }

  function isSellingAllowed(uint256 amount) constant returns (bool) {
    return now > closeDate && soldTokens < minUnits;
  }

  function isFundsTransferAllowed() constant returns (bool) {
    return soldTokens > minUnits;
  }

  function getBuyingPrice(uint256 amount) constant returns (uint256) {
    return price;
  }

  function getSellingPrice(uint256 amount) constant returns (uint256) {
    return price;
  }

  function buy(address holder) payable {
    uint256 units = msg.value / getBuyingPrice(msg.value);
    uint256 returningMoney = msg.value - (units * getBuyingPrice(msg.value));
    if (units <= 0 || !isBuyingAllowed(units)) { throw; }

    soldTokens += units;
    buyers[holder] += units;
    company().assignStock(stockId, holder, units);

    if (returningMoney > 0) {
      if (!holder.send(returningMoney)) { throw; }
    }
  }

  function sell() {
    address holder = msg.sender;
    uint256 buyerBalance = buyers[holder];
    if (!isSellingAllowed(buyerBalance)) { throw; }
    if (buyerBalance <= 0) { throw; }

    buyers[holder] = 0;
    company().removeStock(stockId, holder, buyerBalance);
    if (!holder.send(getSellingPrice(buyerBalance) * buyerBalance)) { throw; }
  }
}
