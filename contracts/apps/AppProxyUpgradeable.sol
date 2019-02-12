pragma solidity 0.4.24;

import "./AppProxyBase.sol";


contract AppProxyUpgradeable is AppProxyBase {
    /**
    * @dev Initialize AppProxyUpgradeable (makes it an upgradeable Aragon app)
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Payload for call to be made after setup to initialize
    */
    constructor(IKernel _kernel, bytes32 _appId, bytes _initializePayload)
        AppProxyBase(_kernel, _appId, _initializePayload)
        public // solium-disable-line visibility-first
    {
        // solium-disable-previous-line no-empty-blocks
    }

    /**
     * @dev ERC897, the address the proxy would delegate calls to
     */
    function implementation() public view returns (address) {
        return getAppBase(appId());
    }

    /**
     * @dev ERC897, whether it is a forwarding (1) or an upgradeable (2) proxy
     */
    function proxyType() public pure returns (uint256 proxyTypeId) {
        return UPGRADEABLE;
    }
}
