pragma solidity 0.4.15;

import "./KernelStorage.sol";

contract KernelProxy is KernelStorage {
    /**
    * @dev KernelProxy is a proxy contract to a kernel implementation. The implementation
    *      can update the reference, which effectively upgrades the contract
    * @param _kernelImpl Address of the contract used as implementation for kernel
    */
    function KernelProxy(address _kernelImpl) {
        kernelImpl = _kernelImpl;
    }

    /**
    * @dev All calls made to the proxy are forwarded to the kernel implementation via a delegatecall
    * @return Any bytes32 value the implementation returns
    */
    function () payable public {
        uint32 len = 32; // only 1 return (can be increased if needed)
        address target = kernelImpl;
        assembly {
            calldatacopy(0x0, 0x0, calldatasize)
            let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
            switch result case 0 { invalid() }
            return (0, len)
        }
    }
}
