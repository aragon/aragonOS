pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/apps/accounting/AccountingApp.sol";
//import "../contracts/dao/DAO.sol";

contract TestAccountingApp {
	function testInitialBalanceUsingDeployedContract() {
		uint expected = 1000;
		Assert.equal(1000, expected, "Place holder test");
	}
}
