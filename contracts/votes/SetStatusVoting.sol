pragma solidity ^0.4.8;

import "./BinaryVoting.sol";
import "../AbstractCompany.sol";

contract SetStatusVoting is BinaryVoting("Yes", "No") {
  uint8 public status;
  address public entity;
  function SetStatusVoting(address _entity, uint8 _status) {
    // Metadata
    entity = _entity;
    status = _status;

    mainSignature = "setEntityStatusByVoting(address,uint8)";
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.setEntityStatusByVoting(entity, status);
    super.executeOnAppove(company);
  }
}
