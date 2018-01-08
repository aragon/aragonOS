pragma solidity 0.4.18;

import "./KernelStorage.sol";
import "../common/DelegateProxy.sol";


contract KernelProxy is KernelStorage, DelegateProxy {
    /**
    * @dev KernelProxy is a proxy contract to a kernel implementation. The implementation
    *      can update the reference, which effectively upgrades the contract
    * @param _kernelImpl Address of the contract used as implementation for kernel
    */
    function KernelProxy(address _kernelImpl) public {
        kernelImpl = _kernelImpl;
    }

    /**
    * @dev All calls made to the proxy are forwarded to the kernel implementation via a delegatecall
    * @return Any bytes32 value the implementation returns
    */
    function () payable public {
        delegatedFwd(kernelImpl, msg.data);
    }
}
