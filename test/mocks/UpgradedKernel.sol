pragma solidity 0.4.15;

import "../../contracts/kernel/Kernel.sol";

contract UpgradedKernel is Kernel {
    // just adds one more function to the kernel implementation.
    // calling this function on the previous instance will fail
    function isUpgraded() constant returns (bool) {
        return true;
    }
}
