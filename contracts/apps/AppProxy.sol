pragma solidity 0.4.15;

import "./AppStorage.sol";
import "../common/DelegateProxy.sol";

contract AppProxy is AppStorage, DelegateProxy {
    function AppProxy(Kernel _kernel, bytes32 _appId) {
        kernel = _kernel;
        appId = _appId;
    }

    function () payable public {
        address target = kernel.getAppCode(appId);
        require(target > 0); // if app code hasn't been set yet, don't call
        delegatedFwd(target, msg.data);
    }
}
