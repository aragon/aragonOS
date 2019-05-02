pragma solidity 0.4.24;

import "../../../apps/UnsafeAragonApp.sol";
import "../../../kernel/IKernel.sol";


contract UnsafeAragonAppMock is UnsafeAragonApp {
    function initialize() public {
        initialized();
    }

    function getKernel() public view returns (IKernel) {
        return kernel();
    }

    function setKernelOnMock(IKernel _kernel) public {
        setKernel(_kernel);
    }
}
