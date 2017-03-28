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

    company.setVotingBylaw("setEntityStatus(address,uint8)", 1, 2, true, minimumVotingTime, favor);
    company.setStatusBylaw("beginPoll(address,uint64,bool,bool)", uint(AbstractCompany.SpecialEntityStatus.Shareholder), true);
    company.setVotingBylaw("addStock(address,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.setVotingBylaw("issueStock(uint8,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.setStatusBylaw("grantStock(uint8,uint256,address)", uint(AbstractCompany.EntityStatus.Executive), false);
    company.setAddressBylaw("grantVestedStock(uint8,uint256,address,uint64,uint64,uint64)", msg.sender, false);

    company.setVotingBylaw("beginSale(address)", 1, 2, true, minimumVotingTime, favor);
    company.setStatusBylaw("transferSaleFunds(uint256)", uint(AbstractCompany.EntityStatus.Executive), false);

    company.setVotingBylaw("setAccountingSettings(uint256,uint64,uint256)", 1, 2, true, minimumVotingTime, favor);
    company.setStatusBylaw("createRecurringReward(address,uint256,uint64,string)", uint(AbstractCompany.EntityStatus.Executive), false);

    company.setStatusBylaw("removeRecurringReward(uint)", uint(AbstractCompany.EntityStatus.Executive), false);
    company.setStatusBylaw("issueReward(address,uint256,string)", uint(AbstractCompany.EntityStatus.Executive), false);

    company.setStatusBylaw("assignStock(uint8,address,uint256)", uint(AbstractCompany.SpecialEntityStatus.StockSale), true);
    company.setStatusBylaw("removeStock(uint8,address,uint256)", uint(AbstractCompany.SpecialEntityStatus.StockSale), true);

    // Protect bylaws under a 2/3 voting
    company.setVotingBylaw("setAddressBylaw(string,address,bool)", 2, 3, false, minimumVotingTime, favor);
    company.setVotingBylaw("setStatusBylaw(string,uint8,bool)", 2, 3, false, minimumVotingTime, favor);
    company.setVotingBylaw("setVotingBylaw(string,uint256,uint256,bool,uint64,uint8)", 2, 3, false, minimumVotingTime, favor); // so meta
  }
}
