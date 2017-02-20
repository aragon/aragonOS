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

    NewCompany(companyAddress, companyIndex);
    companyIndex += 1;
  }

  function createCompany() private returns (address) {
    Company company = new Company();
    company.addTreasure.value(msg.value)('Company bootstrap');
    company.setEntityStatusByStatus(address(configurator), 3);
    configurator.setStockSaleBylaws(company);
    return address(company);
  }

  CompanyConfiguratorFactory public configurator;
  mapping (uint => address) public companies;
  uint public companyIndex;

  event NewCompany(address companyAddress, uint companyIndex);
}
