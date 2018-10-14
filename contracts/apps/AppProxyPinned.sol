pragma solidity 0.4.24;

import "../common/UnstructuredStorage.sol";
import "../common/IsContract.sol";
import "./AppProxyBase.sol";


contract AppProxyPinned is IsContract, AppProxyBase {
    using UnstructuredStorage for bytes32;

    // keccak256("aragonOS.appStorage.pinnedCode")
    bytes32 internal constant PINNED_CODE_POSITION = 0xdee64df20d65e53d7f51cb6ab6d921a0a6a638a91e942e1d8d02df28e31c038e;

    /**
    * @dev Initialize AppProxyPinned (makes it an un-upgradeable Aragon app)
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Payload for call to be made after setup to initialize
    */
    constructor(IKernel _kernel, bytes32 _appId, bytes _initializePayload)
        AppProxyBase(_kernel, _appId, _initializePayload)
        public // solium-disable-line visibility-first
    {
        setPinnedCode(getAppBase(_appId));
        require(isContract(pinnedCode()));
    }

    /**
     * @dev ERC897, the address the proxy would delegate calls to
     */
    function implementation() public view returns (address) {
        return pinnedCode();
    }

    /**
     * @dev ERC897, whether it is a forwarding (1) or an upgradeable (2) proxy
     */
    function proxyType() public pure returns (uint256 proxyTypeId) {
        return FORWARDING;
    }

    function setPinnedCode(address _pinnedCode) internal {
        PINNED_CODE_POSITION.setStorageAddress(_pinnedCode);
    }

    function pinnedCode() internal view returns (address) {
        return PINNED_CODE_POSITION.getStorageAddress();
    }
}
