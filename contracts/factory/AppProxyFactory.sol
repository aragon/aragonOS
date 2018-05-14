pragma solidity 0.4.18;

import "../apps/AppProxyUpgradeable.sol";
import "../apps/AppProxyPinned.sol";


contract AppProxyFactory {
    event NewAppProxy(address proxy, bool isUpgradeable, bytes32 appId);

    function newAppProxy(IKernel _kernel, bytes32 _appId) public returns (AppProxyUpgradeable) {
        return newAppProxy(_kernel, _appId, new bytes(0));
    }

    function newAppProxy(IKernel _kernel, bytes32 _appId, bytes _initializePayload) public returns (AppProxyUpgradeable) {
        AppProxyUpgradeable proxy = new AppProxyUpgradeable(_kernel, _appId, _initializePayload);
        NewAppProxy(address(proxy), true, _appId);
        return proxy;
    }

    function newAppProxyPinned(IKernel _kernel, bytes32 _appId) public returns (AppProxyPinned) {
        return newAppProxyPinned(_kernel, _appId, new bytes(0));
    }

    function newAppProxyPinned(IKernel _kernel, bytes32 _appId, bytes _initializePayload) public returns (AppProxyPinned) {
        AppProxyPinned proxy = new AppProxyPinned(_kernel, _appId, _initializePayload);
        NewAppProxy(address(proxy), false, _appId);
        return proxy;
    }
}
