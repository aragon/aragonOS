pragma solidity ^0.4.6;

import "./BinaryVoting.sol";
import "../AbstractCompany.sol";

contract SetStatusVoting is BinaryVoting("Yes", "No") {
  uint8 public status;
  address public entity;
  function SetStatusVoting(address _entity, uint8 _status, uint8 _percentage) {
    // Metadata
    entity = _entity;
    status = _status;
    neededSupport = uint256(_percentage);
    supportBase = 100;
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.setEntityStatusByVoting(entity, status);
    super.executeOnAppove(company);
  }
}
