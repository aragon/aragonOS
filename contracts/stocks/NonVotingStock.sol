pragma solidity ^0.4.6;

import "./Stock.sol";

contract NonVotingStock is Stock {
  uint8 stockId = 2;
  uint8 votesPerShare = 0;
}
