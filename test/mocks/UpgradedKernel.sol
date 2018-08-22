pragma solidity 0.4.18;

import "../../contracts/kernel/Kernel.sol";


contract UpgradedKernel is Kernel {
    function UpgradedKernel(bool _shouldPetrify) Kernel(_shouldPetrify) public {
    }

    // just adds one more function to the kernel implementation.
    // calling this function on the previous instance will fail
    function isUpgraded() public constant returns (bool) {
        return true;
    }
}
