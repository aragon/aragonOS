pragma solidity ^0.4.8;

import "../Company.sol";
import "./CompanyConfiguratorFactory.sol";

contract CompanyFactory {
  function CompanyFactory(address _configurator) {
    companyIndex = 1;
    configurator = CompanyConfiguratorFactory(_configurator);
  }

  function deployCompany() public payable {
    address companyAddress = createCompany();
    companies[companyIndex] = companyAddress;

    NewCompany(companyAddress, msg.sender, companyIndex);
    companyIndex += 1;
  }

  function createCompany() private returns (address) {
    Company company = new Company();
    company.addTreasure.value(msg.value)('Company bootstrap');
    company.setEntityStatusByStatus(address(configurator), 3);
    configurator.setCompanyDeployer(address(company), msg.sender);
    company.setSpecialBylaws();
    return address(company);
  }

  CompanyConfiguratorFactory public configurator;
  mapping (uint => address) public companies;
  uint public companyIndex;

  event NewCompany(address companyAddress, address deployer, uint companyIndex);
}
