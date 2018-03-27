pragma solidity 0.4.18;


contract VaultMock {
    event LogFund(address sender, uint256 amount);

    function () payable {
        LogFund(msg.sender, msg.value);
    }
}
