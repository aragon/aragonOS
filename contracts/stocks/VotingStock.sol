pragma solidity ^0.4.6;

import "./GrantableStock.sol";

contract VotingStock is GrantableStock {
  uint8 stockId = 1;
  uint8 votesPerShare = 1;
}
