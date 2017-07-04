pragma solidity ^0.4.11;

import "../../contracts/apps/bylaws/BylawsApp.sol";

contract BylawsAppMock is BylawsApp {
  function BylawsAppMock(address dao) BylawsApp(dao) {
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
