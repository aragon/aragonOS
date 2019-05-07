pragma solidity 0.4.24;

import "../../../kernel/Kernel.sol";


/**
 * @title KernelWithoutKillSwitchMock
 * @dev This mock mimics an already deployed Kernel version that does not have a kill-switch integrated
 */
contract KernelWithoutKillSwitchMock is Kernel {
    string private constant ERROR_METHOD_NOT_FOUND = "KERNEL_METHOD_NOT_FOUND";

    constructor() Kernel(true) public {}

    function killSwitch() public view returns (IKillSwitch) {
        revert(ERROR_METHOD_NOT_FOUND);
    }

    function shouldDenyCallingContract(bytes32 _appId) public returns (bool) {
        revert(ERROR_METHOD_NOT_FOUND);
    }
}
