pragma solidity 0.4.18;

import "../../contracts/apps/UnsafeAragonApp.sol";


// Need to use UnsafeAragonApp to allow initialization
contract AppStubStorage is UnsafeAragonApp {
    function initialize() onlyInit public {
        initialized();
    }

    function setKernelExt(IKernel _kernel) public {
        setKernel(_kernel);
    }

    function setAppIdExt(bytes32 _appId) public {
        setAppId(_appId);
    }

    function getKernelPosition() public view returns (bytes32) {
        return KERNEL_POSITION;
    }

    function getAppIdPosition() public view returns (bytes32) {
        return APP_ID_POSITION;
    }

    function getInitializationBlockPosition() public view returns (bytes32) {
        return INITIALIZATION_BLOCK_POSITION;
    }
}
