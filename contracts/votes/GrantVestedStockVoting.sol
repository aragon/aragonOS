pragma solidity ^0.4.6;

import "./BinaryVoting.sol";

contract GrantVestedStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 stock;
  uint256 amount;
  address recipient;
  uint64 cliff;
  uint64 vesting;

  function GrantVestedStockVoting(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting, uint8 _percentage, string _description) {
    stock = _stock;
    amount = _amount;
    recipient = _recipient;
    cliff = _cliff;
    vesting = _vesting;

    // Metadata
    title = "Stock grant";
    description = _description;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.grantVestedStock(stock, amount, recipient, cliff, vesting);
    super.executeOnAppove(company);
  }
}
