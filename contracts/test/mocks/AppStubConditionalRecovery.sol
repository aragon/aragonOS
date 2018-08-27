pragma solidity 0.4.24;

import "../../apps/AragonApp.sol";


contract AppStubConditionalRecovery is AragonApp {
    function initialize() onlyInit public {
        initialized();
        setDepositable(true);
    }

    function allowRecoverability(address token) public view returns (bool) {
        // Doesn't allow to recover ether
        return token != address(0);
    }
}
