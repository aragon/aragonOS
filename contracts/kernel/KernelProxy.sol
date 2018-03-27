pragma solidity 0.4.18;

import "./KernelStorage.sol";
import "../common/FundsProxy.sol";


contract KernelProxy is KernelStorage, FundsProxy {
    /**
    * @dev KernelProxy is a proxy contract to a kernel implementation. The implementation
    *      can update the reference, which effectively upgrades the contract
    * @param _kernelImpl Address of the contract used as implementation for kernel
    */
    function KernelProxy(address _kernelImpl) public {
        apps[keccak256(CORE_NAMESPACE, KERNEL_APP_ID)] = _kernelImpl;
    }

    // FundsProxy implementation

    function getDefaultVault() internal returns (address) {
        return apps[defaultVaultId];
    }

    function getTarget() internal returns (address) {
        return apps[KERNEL_APP];
    }
}
