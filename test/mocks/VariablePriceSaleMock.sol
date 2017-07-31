pragma solidity ^0.4.13;

import "../../contracts/apps/ownership/sales/VariablePriceSale.sol";

contract VariablePriceSaleMock is VariablePriceSale {
  uint64 mock_block;

  function VariablePriceSaleMock() {
    mock_setBlockNumber(uint64(block.number));
  }

  function mock_setBlockNumber(uint64 blockNumber) {
    mock_block = blockNumber;

    if (periods.length > 0) transitionIfNeeded();
  }

  function getBlockNumber() internal returns (uint64) {
    return mock_block;
  }
}
