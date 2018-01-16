pragma solidity 0.4.18;

import "./ACL.sol";
import "./IKernel.sol";
import "./KernelStorage.sol";
import "../common/Initializable.sol";


contract Kernel is KernelStorage, Initializable, IKernel, ACL {
    bytes32 constant public SET_CODE_ROLE = bytes32(2);
    bytes32 constant public UPGRADE_KERNEL_ROLE = bytes32(3);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _permissionsCreator) onlyInit public {
        initialized();

        ACL.initialize(_permissionsCreator);
    }

    /**
    * @dev Changes code reference for `_appId`. This role is required before an app with a certain appId working properly
    * @notice Upgrade app code of `_appId` to new implementation at address `_code` (CRITICAL!)
    * @param _appId Namehash of the app name
    * @param _code Address of new implementation for app
    */
    function setCode(bytes32 _appId, address _code) authP(SET_CODE_ROLE, arr(_appId)) external {
        code[_appId] = _code;
        SetCode(_appId, _code);
    }

    /**
    * @dev Changes kernel implementation reference to a new address
    * @notice Upgrade kernel to new implementation at address `_newKernel` (CRITICAL!)
    * @param _newKernel Address for new kernel code
    */
    function upgradeKernel(address _newKernel) auth(UPGRADE_KERNEL_ROLE) external {
        code[KERNEL_APP_ID] = _newKernel;
        UpgradeKernel(_newKernel);
    }

    /**
    * @dev Function called by AppProxies to get app code reference
    * @param _appId Identifier for app
    * @return address for app code
    */
    function getCode(bytes32 _appId) view public returns (address) {
        return code[_appId];
    }
}
