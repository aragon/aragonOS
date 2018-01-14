pragma solidity 0.4.18;

import "./AppStorage.sol";
import "../common/DelegateProxy.sol";


contract AppProxy is AppStorage, DelegateProxy {
    /**
    * @dev Initialize AppProxy
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Payload for call to be made after setup to initialize
    */
    function AppProxy(IKernel _kernel, bytes32 _appId, bytes _initializePayload) public {
        kernel = _kernel;
        appId = _appId;

        // If initialize payload is provided, it will be executed
        if (_initializePayload.length > 0) {
            address appCode = kernel.getAppCode(appId);
            require(isContract(appCode));
            // Cannot make delegatecall as a delegateproxy.delegatedFwd as it
            // returns ending execution context and halts contract deployment
            require(appCode.delegatecall(_initializePayload));
        }
    }

    function () payable public {
        address target = kernel.getAppCode(appId);
        require(target != 0); // if app code hasn't been set yet, don't call
        delegatedFwd(target, msg.data);
    }
}
