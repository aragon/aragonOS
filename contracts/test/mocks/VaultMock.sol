pragma solidity 0.4.24;

import "../../apps/UnsafeAragonApp.sol";


contract VaultMock is UnsafeAragonApp {
    event LogFund(address sender, uint256 amount);

    function initialize() external {
        initialized();
        setDepositable(true);
    }

    // Override AragonApp's fallback so that we can get an non-instrumented version during coverage
    function () external payable {
        emit LogFund(msg.sender, msg.value);
    }
}
