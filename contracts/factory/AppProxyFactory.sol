pragma solidity 0.4.18;

import "../apps/AppProxyUpgradeable.sol";
import "../apps/AppProxyPinned.sol";


contract AppProxyFactory {
    function newAppProxy(IKernel _kernel, bytes32 _appId) internal returns (AppProxyUpgradeable) {
        return newAppProxy(_kernel, _appId, new bytes(0));
    }

    function newAppProxy(IKernel _kernel, bytes32 _appId, bytes _initializePayload) internal returns (AppProxyUpgradeable) {
        return new AppProxyUpgradeable(_kernel, _appId, _initializePayload);
    }

    function newAppProxyPinned(IKernel _kernel, bytes32 _appId) internal returns (AppProxyPinned) {
        return newAppProxyPinned(_kernel, _appId, new bytes(0));
    }

    function newAppProxyPinned(IKernel _kernel, bytes32 _appId, bytes _initializePayload) internal returns (AppProxyPinned) {
        return new AppProxyPinned(_kernel, _appId, _initializePayload);
    }
}
