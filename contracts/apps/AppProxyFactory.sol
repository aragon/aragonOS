pragma solidity 0.4.18;

import "./AppProxy.sol";


contract AppProxyFactory {
    function newAppProxy(IKernel _kernel, bytes32 _appId) internal returns (AppProxy) {
        return newAppProxy(_kernel, _appId, new bytes(0));
    }

    function newAppProxy(IKernel _kernel, bytes32 _appId, bytes _initializePayload) internal returns (AppProxy) {
        return new AppProxy(_kernel, _appId, _initializePayload);
    }
}
