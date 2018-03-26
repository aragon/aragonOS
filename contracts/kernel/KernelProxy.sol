pragma solidity 0.4.18;

import "./KernelStorage.sol";
import "../common/DelegateProxy.sol";
import "../lib/misc/ERCProxy.sol";

contract KernelProxy is KernelStorage, DelegateProxy, ERCProxy {
    /**
    * @dev KernelProxy is a proxy contract to a kernel implementation. The implementation
    *      can update the reference, which effectively upgrades the contract
    * @param _kernelImpl Address of the contract used as implementation for kernel
    */
    function KernelProxy(address _kernelImpl) public {
        apps[keccak256(CORE_NAMESPACE, KERNEL_APP_ID)] = _kernelImpl;
    }

    /**
    * @dev All calls made to the proxy are forwarded to the kernel implementation via a delegatecall
    * @return Any bytes32 value the implementation returns
    */
    function () payable public {
        delegatedFwd(apps[KERNEL_APP], msg.data);
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
        return apps[KERNEL_APP];
    }

}
