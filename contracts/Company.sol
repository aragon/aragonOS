pragma solidity ^0.4.6;

import "./stocks/Stock.sol";

import "./stocks/IssueableStock.sol";
import "./stocks/GrantableStock.sol";

contract Company {
  mapping (uint8 => address) public stocks;
  uint8 public stockIndex;

  event NewStock(address stockAddress, uint8 stockIndex);

  function addStock(address newStock) {
    if (Stock(newStock).company() != address(this)) throw;

    stocks[stockIndex] = newStock;
    stockIndex += 1;

    NewStock(newStock, stockIndex - 1);
  }

  function issueStock(uint8 _stock, uint256 _amount) {
    IssueableStock(stocks[_stock]).issueStock(_amount);
  }

  function grantStock(uint8 _stock, uint256 _amount, address _recipient) {
    GrantableStock(stocks[_stock]).grantStock(_recipient, _amount);
  }
}
