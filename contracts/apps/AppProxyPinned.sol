pragma solidity 0.4.18;

import "./AppProxyBase.sol";


contract AppProxyPinned is AppProxyBase {
    /**
    * @dev Initialize AppProxyPinned (makes it an un-upgradeable Aragon app)
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Payload for call to be made after setup to initialize
    */
    function AppProxyPinned(IKernel _kernel, bytes32 _appId, bytes _initializePayload)
             AppProxyBase(_kernel, _appId, _initializePayload) public
    {
        pinnedCode = getAppBase(appId);
        require(pinnedCode != address(0));
    }

    function getCode() public view returns (address) {
        return pinnedCode;
    }

    function isUpgradeable() public pure returns (bool) {
        return false;
    }

    function () payable public {
        delegatedFwd(getCode(), msg.data);
    }
}