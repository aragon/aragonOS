pragma solidity 0.4.24;

import "../apps/AppProxyUpgradeable.sol";
import "../apps/AppProxyPinned.sol";


contract AppProxyFactory {
    event NewAppProxy(address proxy, bool isUpgradeable, bytes32 appId);

    /**
    * @notice Create a new instance of AppProxyUpgradeable. Reference to organization kernel: `_kernel`, app ID: `_appId`
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @returns newly created AppProxyUpgradeable
    */
    function newAppProxy(IKernel _kernel, bytes32 _appId) public returns (AppProxyUpgradeable) {
        return newAppProxy(_kernel, _appId, new bytes(0));
    }

    /**
    * @notice Create a new instance of AppProxyUpgradeable. Reference to organization kernel: `_kernel`, app ID: `_appId`, init payload: `_initializePayload`
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Proxy initialization payload
    * @returns newly created AppProxyUpgradeable
    */
    function newAppProxy(IKernel _kernel, bytes32 _appId, bytes _initializePayload) public returns (AppProxyUpgradeable) {
        AppProxyUpgradeable proxy = new AppProxyUpgradeable(_kernel, _appId, _initializePayload);
        emit NewAppProxy(address(proxy), true, _appId);
        return proxy;
    }

    /**
    * @notice Create a new instance of AppProxyPinned. Reference to organization kernel: `_kernel`, app ID: `_appId`
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @returns newly created AppProxyPinned
    */
    function newAppProxyPinned(IKernel _kernel, bytes32 _appId) public returns (AppProxyPinned) {
        return newAppProxyPinned(_kernel, _appId, new bytes(0));
    }

    /**
    * @notice Create a new instance of AppProxyPinned. Reference to organization kernel: `_kernel`, app ID: `_appId`, init payload: `_initializePayload`
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Proxy initialization payload
    * @returns newly created AppProxyPinned
    */
    function newAppProxyPinned(IKernel _kernel, bytes32 _appId, bytes _initializePayload) public returns (AppProxyPinned) {
        AppProxyPinned proxy = new AppProxyPinned(_kernel, _appId, _initializePayload);
        emit NewAppProxy(address(proxy), false, _appId);
        return proxy;
    }
}
