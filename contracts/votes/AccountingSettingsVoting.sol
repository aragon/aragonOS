pragma solidity ^0.4.8;

import "./BinaryVoting.sol";

contract AccountingSettingsVoting is BinaryVoting("Approve issuing", "Reject") {
  uint256 public budget;
  uint64 public periodDuration;
  uint256 public dividendThreshold;

  function AccountingSettingsVoting(uint256 _budget, uint64 _periodDuration, uint256 _dividendThreshold) {
    budget = _budget;
    periodDuration = _periodDuration;
    dividendThreshold = _dividendThreshold;
    mainSignature = "setAccountingSettings(uint256,uint64,uint256)";
  }

  function executeOnAppove(AbstractCompany company) internal {
    company.setAccountingSettings(budget, periodDuration, dividendThreshold);
    super.executeOnAppove(company);
  }
}
