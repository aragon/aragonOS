pragma solidity ^0.4.8;

import "../AbstractCompany.sol";
import "../stocks/VotingStock.sol";
import "../votes/BinaryVoting.sol";

contract CompanyConfiguratorFactory {
  mapping (address => address) companyDeployer;
  address deployer;
  address factory;

  modifier only(address x) {
    if (msg.sender != x) throw;
    _;
  }

  function CompanyConfiguratorFactory() {
    deployer = msg.sender;
  }

  function setFactory(address _factory) only(deployer) {
    factory = _factory;
  }

  function setCompanyDeployer(address company, address deployer) only(factory) {
    companyDeployer[company] = deployer;
  }

  function configureCompany(address companyAddress, address god) only(companyDeployer[companyAddress]) {
    AbstractCompany company = AbstractCompany(companyAddress);
    if (god == 0x0) god = msg.sender;
    createVotingStock(company, god);
    setExecutives(company, god);
    setInitialBylaws(company);
    // TODO: clean up fatcory and conf entity states
  }

  function createVotingStock(AbstractCompany company, address god) private {
    VotingStock stock = new VotingStock(address(company));
    company.addStock(address(stock), 1);
    company.grantStock(0, 1, god);
  }

  function setExecutives(AbstractCompany company, address executive) {
    company.setEntityStatusByStatus(executive, 2);
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
