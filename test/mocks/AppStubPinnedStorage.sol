pragma solidity 0.4.24;

import "../../contracts/apps/AppProxyPinned.sol";
import "../../contracts/kernel/IKernel.sol";


contract AppStubPinnedStorage is AppProxyPinned {
    bytes32 constant FAKE_APP_ID = keccak256('FAKE_APP_ID');
    address constant FAKE_APP_ADDR = address(1);

    // Allow the mock to be created without any arguments
    function AppStubPinnedStorage()
        AppProxyPinned(IKernel(0), FAKE_APP_ID, new bytes(0))
        public // solium-disable-line visibility-first
    {}

    // Overload base to return our own fake address
    function getAppBase(bytes32 _appId) internal view returns (address) {
        return FAKE_APP_ADDR;
    }

    function setPinnedCodeExt(address _pinnedCode) public {
        setPinnedCode(_pinnedCode);
    }

    function getPinnedCodePosition() public view returns (bytes32) {
        return PINNED_CODE_POSITION;
    }

    function pinnedCodeExt() public view returns (address) {
        return pinnedCode();
    }
}
