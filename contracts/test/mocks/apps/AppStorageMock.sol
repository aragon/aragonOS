pragma solidity 0.4.24;

import "../../../apps/AppStorage.sol";


contract AppStorageMock is AppStorage {
    function setKernelExt(IKernel _kernel) public {
        setKernel(_kernel);
    }

    function setAppIdExt(bytes32 _appId) public {
        setAppId(_appId);
    }

    function getKernelPosition() public pure returns (bytes32) {
        return KERNEL_POSITION;
    }

    function getAppIdPosition() public pure returns (bytes32) {
        return APP_ID_POSITION;
    }
}
