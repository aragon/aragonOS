pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/apps/accounting/AccountingApp.sol";

contract TestAccountingApp {
    function testInitialBalanceUsingDeployedContract() {

        uint expected = 10000;

        Assert.equal(1000, expected, "Owner should have 10000 MetaCoin initially");
    }

}
