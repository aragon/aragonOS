pragma solidity 0.4.18;

import "../../contracts/apps/AppProxyPinned.sol";
import "../../contracts/kernel/IKernel.sol";
import "../../contracts/kernel/Kernel.sol";


contract FakeAppConstants {
    bytes32 constant FAKE_APP_ID = keccak256('FAKE_APP_ID');
}

contract KernelPinnedStorageMock is Kernel, FakeAppConstants {
    bytes32 constant FAKE_APP_ID = keccak256('FAKE_APP_ID');
    function KernelPinnedStorageMock(address _fakeApp) Kernel(false) public {
        _setApp(APP_BASES_NAMESPACE, FAKE_APP_ID, _fakeApp);
    }
}


// Testing this contract is a bit of a pain... we can't overload anything to make the contract check
// pass in the constructor, so we're forced to initialize this with a mocked Kernel that already
// sets a contract for the fake app.
contract AppStubPinnedStorage is AppProxyPinned, FakeAppConstants {
    function AppStubPinnedStorage(KernelPinnedStorageMock _mockKernel)
        AppProxyPinned(IKernel(_mockKernel), FAKE_APP_ID, new bytes(0))
        public // solium-disable-line visibility-first
    {
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
