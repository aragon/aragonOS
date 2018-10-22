pragma solidity 0.4.24;

import "./IKernel.sol";
import "./KernelConstants.sol";
import "./KernelStorage.sol";
import "../common/DepositableDelegateProxy.sol";
import "../common/IsContract.sol";


contract KernelProxy is KernelStorage, KernelAppIds, KernelNamespaceConstants, IsContract, DepositableDelegateProxy {
    /**
    * @dev KernelProxy is a proxy contract to a kernel implementation. The implementation
    *      can update the reference, which effectively upgrades the contract
    * @param _kernelImpl Address of the contract used as implementation for kernel
    */
    constructor(IKernel _kernelImpl) public {
        require(isContract(address(_kernelImpl)));
        apps[KERNEL_CORE_NAMESPACE][KERNEL_CORE_APP_ID] = _kernelImpl;
    }

    /**
     * @dev ERC897, whether it is a forwarding (1) or an upgradeable (2) proxy
     */
    function proxyType() public pure returns (uint256 proxyTypeId) {
        return UPGRADEABLE;
    }

    /**
    * @dev ERC897, the address the proxy would delegate calls to
    */
    function implementation() public view returns (address) {
        return apps[KERNEL_CORE_NAMESPACE][KERNEL_CORE_APP_ID];
    }
}
