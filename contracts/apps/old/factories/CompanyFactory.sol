pragma solidity ^0.4.8;

import "../Company.sol";
import "./CompanyConfiguratorFactory.sol";

contract CompanyFactory {
  function CompanyFactory(address _configurator) {
    configurator = CompanyConfiguratorFactory(_configurator);
  }

  function deployCompany() public payable {
    address companyAddress = createCompany();
    NewCompany(companyAddress, msg.sender);
  }

  function createCompany() private returns (address) {
    Company company = new Company();
    company.addTreasure.value(msg.value)('');
    company.setEntityStatusByStatus(address(configurator), 3);
    configurator.setCompanyDeployer(address(company), msg.sender);
    return address(company);
  }

  CompanyConfiguratorFactory public configurator;

  event NewCompany(address companyAddress, address deployer);
}
