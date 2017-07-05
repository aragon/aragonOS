pragma solidity ^0.4.11;

import "./IStockSale.sol";

contract StockSale is IStockSale {
  uint256 public soldTokens;
  uint256 public boughtTokens;
  uint256 public raisedAmount;

  address public dao;
  uint8 public tokenId;
  string public saleTitle;
  uint64 public closeDate;

  mapping (address => uint256) public boughtAmount;
  mapping (uint256 => address) public buyers;
  uint256 public buyerIndex;

  function afterBuy(address buyer, uint256 value, uint256 price) internal {
    soldTokens += value;
    raisedAmount += price * value;
    boughtAmount[buyer] += value;
    buyers[buyerIndex] = buyer;
    buyerIndex += 1;

    TokensBought(buyer, value, price);
  }

  function transferFunds() {
    if (!isFundsTransferAllowed()) throw;
    if (msg.sender != dao) throw; // only allow dao to request it
    if (!dao.send(this.balance)) throw; // send all the funds
  }

  function () payable {
    buy(msg.sender);
  }
}
