pragma solidity 0.4.18;

import "./AppProxyBase.sol";


contract AppProxyPinned is AppProxyBase {
    address public pinnedCode;

    /**
    * @dev Initialize AppProxyPinned (makes it an un-upgradeable Aragon app)
    * @param _kernel Reference to organization kernel for the app
    * @param _appId Identifier for app
    * @param _initializePayload Payload for call to be made after setup to initialize
    */
    function AppProxyPinned(IKernel _kernel, bytes32 _appId, bytes _initializePayload)
             AppProxyBase(_kernel, _appId, _initializePayload) public {
        pinnedCode = kernel.getAppCode(appId);
        require(pinnedCode != address(0));
    }

    function getCode() public view returns (address) {
        return pinnedCode;
    }

    function isUpgradeable() public pure returns (bool) {
        return false;
    }

    function () payable public {
        address target = getCode();
        Log(target);
        require(target != 0); // if app code hasn't been set yet, don't call
        delegatedFwd(target, msg.data);
    }

    event Log(address a);
}
