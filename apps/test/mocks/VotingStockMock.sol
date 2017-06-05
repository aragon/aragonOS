pragma solidity ^0.4.8;

import "../../contracts/stocks/VotingStock.sol";

contract VotingStockMock is VotingStock {
  function VotingStockMock(address a) VotingStock(a) {}

  function setDelegateMocked(address delegator, address newDelegate) {
    publicDelegate[newDelegate] = true;
    setDelegate(delegator, newDelegate);
  }
}
