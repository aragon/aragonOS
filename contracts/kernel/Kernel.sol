pragma solidity 0.4.18;

import "./IKernel.sol";
import "./KernelStorage.sol";
import "../common/Initializable.sol";


contract Kernel is KernelStorage, Initializable, IKernel {
    bytes32 constant public APP_MANAGER = bytes32(1);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _acl ACL for DAO
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(IACL _acl, address baseACL, address _permissionsCreator) onlyInit public {
        initialized();

        setApp(APP_BASES_NAMESPACE, ACL_APP_ID, baseACL);
        setApp(APP_ADDR_NAMESPACE, ACL_APP_ID, _acl);
        _acl.initialize(_permissionsCreator);
    }

    function setApp(bytes32 namespace, bytes32 name, address app) auth(APP_MANAGER) public returns (bytes32 id) {
        id = keccak256(namespace, name);
        apps[id] = app;
        SetApp(namespace, name, id, app);
    }

    function getApp(bytes32 id) public view returns (address) {
        return apps[id];
    }

    function acl() view public returns (IACL) {
        return IACL(getApp(ACL_APP));
    }

    /**
    * @dev Function called by apps to check ACL on kernel or to check permission status
    * @param who Sender of the original call
    * @param where Address of the app
    * @param what Identifier for a group of actions in app
    * @param how Extra data for ACL auth
    * @return boolean indicating whether the ACL allows the role or not
    */
    function hasPermission(address who, address where, bytes32 what, bytes how) view public returns (bool) {
        IACL _acl = acl();
        return _acl == address(0) ? true : _acl.hasPermission(who, where, what, how);
    }

    modifier auth(bytes32 _role) {
        require(hasPermission(msg.sender, address(this), _role, new bytes(0)));
        _;
    }
}
