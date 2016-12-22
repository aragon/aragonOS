pragma solidity ^0.4.6;

import "./BinaryVoting.sol";

contract GrantVestedStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 public stock;
  uint256 public amount;
  address public recipient;
  uint64 public cliff;
  uint64 public vesting;

  function GrantVestedStockVoting(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting, uint8 _percentage) {
    stock = _stock;
    amount = _amount;
    recipient = _recipient;
    cliff = _cliff;
    vesting = _vesting;

    // Metadata
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.grantVestedStock(stock, amount, recipient, cliff, vesting);
    super.executeOnAppove(company);
  }
}
