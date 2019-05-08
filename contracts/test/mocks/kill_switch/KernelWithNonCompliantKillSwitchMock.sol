pragma solidity 0.4.24;

import "../../../kernel/Kernel.sol";


/**
 * @title KernelWithNonCompliantKillSwitchMock
 * @dev This mock mimics a situation where the kernel returns an unexpected result for a kill-switch check
 */
contract KernelWithNonCompliantKillSwitchMock is Kernel {
    constructor() Kernel(true) public {}

    function shouldDenyCallingContract(bytes32 _appId) public returns (bool) {
        assembly {
            return(0, 0x40) // returning 2 words instead of one
        }
    }
}
