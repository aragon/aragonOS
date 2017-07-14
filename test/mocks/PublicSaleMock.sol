pragma solidity ^0.4.11;

import "../../contracts/apps/ownership/sales/PublicSale.sol";

contract PublicSaleMock is PublicSale {
  uint64 mock_block;

  function IndividualSaleMock() {
    mock_setBlockNumber(uint64(block.number));
  }

  function mock_setBlockNumber(uint64 blockNumber) {
    mock_block = blockNumber;
  }

  function getBlockNumber() internal returns (uint64) {
    return mock_block;
  }
}
