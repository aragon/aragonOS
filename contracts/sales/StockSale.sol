pragma solidity ^0.4.6;

import "../Txid.sol";
import "../AbstractCompany.sol";

contract StockSale is Txid {
  uint256 public soldTokens;
  uint256 public boughtTokens;
  uint256 public raisedAmount;

  address public companyAddress;
  uint8 public stockId;
  string public saleTitle;
  string public saleType;
  uint64 public closeDate;

  function StockSale(string _type) {
    saleType = _type;
  }

  function availableTokens() constant returns (uint256);
  function isBuyingAllowed(uint256 amount) constant returns (bool);
  function isSellingAllowed(uint256 amount) constant returns (bool);
  function isFundsTransferAllowed() constant returns (bool);

  function getBuyingPrice(uint256 amount) constant returns (uint256);
  function getSellingPrice(uint256 amount) constant returns (uint256);

  function buy(address holder) payable;
  function sell();

  function company() constant returns (AbstractCompany) {
    return AbstractCompany(companyAddress);
  }

  function transferFunds() {
    if (!isFundsTransferAllowed()) { throw; }
    if (!companyAddress.send(this.balance)) { throw; }
  }

  function () payable {
    buy(msg.sender);
  }

  event StockBought(uint256 units, uint256 price);
  event StockSold(uint256 units, uint256 price);
}
