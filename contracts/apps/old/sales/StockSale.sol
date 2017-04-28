pragma solidity ^0.4.8;

import "../../../misc/Txid.sol";
import "./AbstractStockSale.sol";

contract StockSale is AbstractStockSale, Txid {
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
}
