pragma solidity ^0.4.8;

import "./BinaryVoting.sol";

contract GrantVestedStockVoting is BinaryVoting("Approve issuing", "Reject") {
  uint8 public stock;
  uint256 public amount;
  address public recipient;
  uint64 public cliff;
  uint64 public vesting;

  function GrantVestedStockVoting(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting) {
    stock = _stock;
    amount = _amount;
    recipient = _recipient;
    cliff = _cliff;
    vesting = _vesting;

    mainSignature = "grantVestedStock(uint8,uint256,address,uint64,uint64)";
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.grantVestedStock(stock, amount, recipient, cliff, vesting);
    super.executeOnAppove(company);
  }
}
