pragma solidity 0.4.18;

import "./IKernel.sol";
import "./KernelStorage.sol";
import "../common/Initializable.sol";
import "../acl/ACLSyntaxSugar.sol";


contract Kernel is IKernel, KernelStorage, Initializable, ACLSyntaxSugar {
    bytes32 constant public APP_MANAGER_ROLE = bytes32(1);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _acl ACL AppProxy instance
    * @param _baseAcl address of deployed ACL contract
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(IACL _acl, address _baseAcl, address _permissionsCreator) onlyInit public {
        initialized();

        setApp(APP_BASES_NAMESPACE, ACL_APP_ID, _baseAcl);
        setApp(APP_ADDR_NAMESPACE, ACL_APP_ID, _acl);
        _acl.initialize(_permissionsCreator);
    }

    /**
    * @dev Set the resolving address of an app instance or base implementation
    * @param _namespace App namespace to use
    * @param _name Name of the app
    * @param _app Address of the app
    * @return ID of app
    */
    function setApp(bytes32 _namespace, bytes32 _name, address _app) auth(APP_MANAGER_ROLE, arr(_namespace, _name)) public returns (bytes32 id) {
        id = keccak256(_namespace, _name);
        apps[id] = _app;
        SetApp(_namespace, _name, id, _app);
    }

    /**
    * @dev Get the address of an app instance or base implementation
    * @param _id App identifier
    * @return Address of the app
    */
    function getApp(bytes32 _id) public view returns (address) {
        return apps[_id];
    }

    /**
    * @dev Get the installed ACL app
    * @return ACL app
    */
    function acl() public view returns (IACL) {
        return IACL(getApp(ACL_APP));
    }

    /**
    * @dev Function called by apps to check ACL on kernel or to check permission status
    * @param _who Sender of the original call
    * @param _where Address of the app
    * @param _what Identifier for a group of actions in app
    * @param _how Extra data for ACL auth
    * @return boolean indicating whether the ACL allows the role or not
    */
    function hasPermission(address _who, address _where, bytes32 _what, bytes _how) public view returns (bool) {
        IACL _acl = acl();
        return address(_acl) == address(0) ? true : _acl.hasPermission(_who, _where, _what, _how);
    }

    modifier auth(bytes32 _role, uint256[] memory params) {
        bytes memory how;
        uint256 byteLength = params.length * 32;
        assembly {
            how := params // forced casting
            mstore(how, byteLength)
        }
        // Params is invalid from this point fwd
        require(hasPermission(msg.sender, address(this), _role, how));
        _;
    }
}
