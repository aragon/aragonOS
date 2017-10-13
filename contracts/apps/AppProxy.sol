pragma solidity 0.4.15;

import "./AppStorage.sol";

contract AppProxy is AppStorage {
    function AppProxy(IKernel _kernel, bytes32 _appId) {
        kernel = _kernel;
        appId = _appId;
    }

    function () payable public {
        uint32 len = 320; // 10 return size
        address target = kernel.getAppCode(appId);
        require(target > 0); // if app code hasn't been set yet, don't call
        assembly {
            calldatacopy(0x0, 0x0, calldatasize)
            let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
            switch result case 0 { invalid() }
            return (0, len)
        }
    }
}
