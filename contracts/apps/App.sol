pragma solidity 0.4.15;

import "./AppStorage.sol";

contract App is AppStorage {
    modifier auth {
        require(kernel.canPerform(msg.sender, address(this), msg.sig));
        _;
    }
}
