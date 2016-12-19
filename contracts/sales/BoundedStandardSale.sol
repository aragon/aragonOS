pragma solidity ^0.4.6;

import "./StockSale.sol";

contract BoundedStandardSale is StockSale {
  uint256 public minUnits;
  uint256 public maxUnits;
  uint256 public price;
  uint64 public closeDate;

  mapping (address => uint256) buyers;

  function BoundedStandardSale(address _companyAddress, uint8 _stockId, uint256 _min, uint256 _max, uint256 _price, uint64 _closeDate) {
    companyAddress = _companyAddress;
    stockId = _stockId;

    minUnits = _min;
    maxUnits = _max;
    price = _price;
    closeDate = _closeDate;
  }

  function isBuyingAllowed(uint256 amount) returns (bool) {
    return soldTokens + amount <= maxUnits;
  }

  function isSellingAllowed(uint256 amount) returns (bool) {
    return now > closeDate && soldTokens < minUnits;
  }

  function isFundsTransferAllowed() returns (bool) {
    return soldTokens > minUnits;
  }

  function getBuyingPrice(uint256 amount) returns (uint256) {
    return price;
  }

  function getSellingPrice(uint256 amount) returns (uint256) {
    return price;
  }

  function buy() payable {
    address holder = msg.sender;
    uint256 units = msg.value / price;
    uint256 returningMoney = msg.value - (units * price);
    if (units <= 0 || !isBuyingAllowed(units)) { throw; }

    if (returningMoney > 0) {
      if (!holder.send(returningMoney)) { throw; }
    }

    soldTokens += units;
    buyers[holder] += units;
    company().assignStock(stockId, holder, units);
  }

  function sell() {
    address holder = msg.sender;
    uint256 buyerBalance = buyers[holder];
    if (!isSellingAllowed(buyerBalance)) { throw; }
    if (buyerBalance <= 0) { throw; }

    buyers[holder] = 0;
    company().removeStock(stockId, holder, buyerBalance);
    if (!holder.send(price * buyerBalance)) { throw; }
  }
}
