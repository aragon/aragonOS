pragma solidity 0.4.18;

import "../../contracts/apps/AragonApp.sol";


contract AppStubStorage is AragonApp {
    bytes32 constant public ROLE = bytes32(1);

    function initialize() onlyInit public {
        initialized();
    }

    function setKernelExt(IKernel _kernel) public {
        setKernel(_kernel);
    }

    function setAppIdExt(bytes32 _appId) public {
        setAppId(_appId);
    }

    function setPinnedCodeExt(address _pinnedCode) public {
        setPinnedCode(_pinnedCode);
    }

    function getKernelPosition() public view returns (bytes32) {
        return kernelPosition;
    }

    function getAppIdPosition() public view returns (bytes32) {
        return appIdPosition;
    }

    function getPinnedCodePosition() public view returns (bytes32) {
        return pinnedCodePosition;
    }

    function getInitializationBlockPosition() public view returns (bytes32) {
        return initializationBlockPosition;
    }

    function pinnedCodeExt() public view returns (address) {
        return pinnedCode();
    }
}
