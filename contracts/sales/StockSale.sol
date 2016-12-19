pragma solidity ^0.4.6;

import "../AbstractCompany.sol";

contract StockSale {
  uint256 public soldTokens;
  uint256 public boughtTokens;

  address public companyAddress;
  uint8 public stockId;

  function isBuyingAllowed(uint256 amount) returns (bool);
  function isSellingAllowed(uint256 amount) returns (bool);
  function isFundsTransferAllowed() returns (bool);

  function getBuyingPrice(uint256 amount) returns (uint256);
  function getSellingPrice(uint256 amount) returns (uint256);

  function buy() payable;
  function sell();

  function company() returns (AbstractCompany) {
    return AbstractCompany(companyAddress);
  }

  function transferFunds() {
    if (!isFundsTransferAllowed()) { throw; }
    if (!companyAddress.send(this.balance)) { throw; }
  }
}
