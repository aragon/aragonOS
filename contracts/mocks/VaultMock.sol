pragma solidity 0.4.24;

import "../apps/AragonApp.sol";


contract VaultMock is AragonApp {
    event LogFund(address sender, uint256 amount);

    function () external payable {
        emit LogFund(msg.sender, msg.value);
    }
}
