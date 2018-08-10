pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";


contract VaultMock is AragonApp {
    event LogFund(address sender, uint256 amount);

    function () external payable {
        LogFund(msg.sender, msg.value);
    }
}
