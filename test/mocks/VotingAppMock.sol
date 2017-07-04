pragma solidity ^0.4.11;

import "../../contracts/apps/basic-governance/VotingApp.sol";

contract VotingAppMock is VotingApp {
  function VotingAppMock(address dao) VotingApp(dao) {
    mock_block = uint64(block.number);
  }

  uint64 mock_block;

  function mock_setBlockNumber(uint64 blockNumber) {
    mock_block = blockNumber;
  }

  function getBlockNumber() internal returns (uint64) {
    return mock_block;
  }
}
