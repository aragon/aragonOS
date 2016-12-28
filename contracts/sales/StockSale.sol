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
  uint64 public closeDate;

  mapping (address => uint256) public buyers;
  mapping (uint256 => address) public investors;
  uint256 public investorIndex;

  function raiseMaximum() constant returns (uint256);
  function raiseTarget() constant returns (uint256);

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

  function afterBuy(address investor, uint256 units, uint256 price) {
    soldTokens += units;
    raisedAmount += price * units;
    buyers[investor] += units;
    investors[investorIndex] = investor;
    investorIndex += 1;

    StockBought(units, price);
  }

  function transferFunds() {
    if (!isFundsTransferAllowed()) throw;
    if (msg.sender != companyAddress) throw; // only allow company to request it
    if (!AbstractCompany(companyAddress).addTreasure.value(this.balance)(saleTitle)) throw;
  }

  function () payable {
    buy(msg.sender);
  }

  event StockBought(uint256 units, uint256 price);
  event StockSold(uint256 units, uint256 price);
}
