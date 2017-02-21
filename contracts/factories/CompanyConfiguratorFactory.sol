pragma solidity ^0.4.8;

import "../AbstractCompany.sol";
import "../stocks/VotingStock.sol";
import "../votes/BinaryVoting.sol";

contract CompanyConfiguratorFactory {
  function configureCompany(address companyAddress, uint256 totalShares, address[] executives, address[] shareholders, uint256[] balances) {
    AbstractCompany company = AbstractCompany(companyAddress);
    createVotingStock(company, totalShares, shareholders, balances);
    setExecutives(company, executives);
    setInitialBylaws(company);
  }

  function createVotingStock(AbstractCompany company, uint256 totalShares, address[] shareholders, uint256[] balances) private {
    VotingStock stock = new VotingStock(address(company));
    company.addStock(address(stock), totalShares);

    if (shareholders.length != balances.length) throw;

    for (uint i = 0; i < shareholders.length; i++) {
      company.grantStock(0, balances[i], shareholders[i]);
    }
  }

  function setExecutives(AbstractCompany company, address[] executives) {
    for (uint j = 0; j < executives.length; j++) {
      company.setEntityStatusByStatus(executives[j], 2);
    }
  }

  function setInitialBylaws(AbstractCompany company) {
    uint8 favor = uint8(BinaryVoting.VotingOption.Favor);
    uint64 minimumVotingTime = uint64(7 days);

    company.addVotingBylaw("setEntityStatus(address,uint8)", 1, 2, true, minimumVotingTime, favor);
    company.addSpecialStatusBylaw("beginPoll(address,uint64,bool,bool)", AbstractCompany.SpecialEntityStatus.Shareholder);
    company.addVotingBylaw("addStock(address,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.addVotingBylaw("issueStock(uint8,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.addStatusBylaw("grantStock(uint8,uint256,address)", AbstractCompany.EntityStatus.Executive);
    company.addVotingBylaw("grantVestedStock(uint8,uint256,address,uint64,uint64,uint64)", 1, 2, true, minimumVotingTime, favor);

    company.addVotingBylaw("beginSale(address)", 1, 2, true, minimumVotingTime, favor);
    company.addStatusBylaw("transferSaleFunds(uint256)", AbstractCompany.EntityStatus.Executive);

    company.addVotingBylaw("setAccountingSettings(uint256,uint64,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.addStatusBylaw("createRecurringReward(address,uint256,uint64,string)", AbstractCompany.EntityStatus.Executive);

    company.addStatusBylaw("removeRecurringReward(uint)", AbstractCompany.EntityStatus.Executive);
    company.addStatusBylaw("issueReward(address,uint256,string)", AbstractCompany.EntityStatus.Executive);

    // Protect bylaws under a 2/3 voting
    company.addVotingBylaw("addStatusBylaw(string,uint8)", 2, 3, false, minimumVotingTime, favor);
    company.addVotingBylaw("addSpecialStatusBylaw(string,uint8)", 2, 3, false, minimumVotingTime, favor);
    company.addVotingBylaw("addVotingBylaw(string,uint256,uint256,bool,uint64,uint8)", 2, 3, false, minimumVotingTime, favor); // so meta
  }
}
