pragma solidity 0.4.18;

import "../../contracts/apps/UnsafeAragonApp.sol";
import "../../contracts/kernel/IKernel.sol";


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
