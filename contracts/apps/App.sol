pragma solidity 0.4.15;

import "./AppStorage.sol";

contract App is AppStorage {
    modifier auth {
        require(address(kernel) == 0 || kernel.canPerform(msg.sender, address(this), msg.sig));
        _;
    }
}
