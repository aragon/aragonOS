pragma solidity 0.4.18;

import "./IKernel.sol";
import "./KernelStorage.sol";
import "../acl/ACLSyntaxSugar.sol";
import "../lib/misc/ERCProxy.sol";
import "../common/Initializable.sol";
import "../common/IsContract.sol";
import "../common/VaultRecoverable.sol";
import "../factory/AppProxyFactory.sol";


contract Kernel is IKernel, KernelStorage, Initializable, IsContract, AppProxyFactory, ACLSyntaxSugar, VaultRecoverable {
    // Hardocde constant to save gas
    //bytes32 constant public APP_MANAGER_ROLE = keccak256("APP_MANAGER_ROLE");
    //bytes32 constant public DEFAULT_VAULT_ID = keccak256(APP_ADDR_NAMESPACE, apmNamehash("vault"));
    bytes32 constant public APP_MANAGER_ROLE = 0xb6d92708f3d4817afc106147d969e229ced5c46e65e0a5002a0d391287762bd0;
    bytes32 constant public DEFAULT_VAULT_ID = 0x4214e5fd6d0170d69ea641b5614f5093ebecc9928af51e95685c87617489800e;

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance along with its ACL and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _baseAcl Address of base ACL app
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _baseAcl, address _permissionsCreator) onlyInit public {
        initialized();

        IACL acl = IACL(newAppProxy(this, ACL_APP_ID));

        _setApp(APP_BASES_NAMESPACE, ACL_APP_ID, _baseAcl);
        _setApp(APP_ADDR_NAMESPACE, ACL_APP_ID, acl);

        acl.initialize(_permissionsCreator);

        recoveryVaultId = DEFAULT_VAULT_ID;
    }

    /**
    * @dev Create a new instance of an app linked to this kernel
    * @param _name Name of the app
    * @param _appBase Address of the app's base implementation
    * @return AppProxy instance
    */
    function newAppInstance(bytes32 _name, address _appBase) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
        return newAppInstance(_name, _appBase, false);
    }

    /**
    * @dev Create a new instance of an app linked to this kernel and set its base
    *      implementation if it was not already set
    * @param _name Name of the app
    * @param _appBase Address of the app's base implementation
    * @param _setDefault Whether the app proxy app is the default one.
    *        Useful when the Kernel needs to know of an instance of a particular app,
    *        like Vault for escape hatch mechanism.
    * @return AppProxy instance
    */
    function newAppInstance(bytes32 _name, address _appBase, bool _setDefault) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
        _setAppIfNew(APP_BASES_NAMESPACE, _name, _appBase);
        appProxy = newAppProxy(this, _name);
        // By calling setApp directly and not the internal functions, we make sure the params are checked
        // and it will only succeed if sender has permissions to set something to the namespace.
        if (_setDefault) {
            setApp(APP_ADDR_NAMESPACE, _name, appProxy);
        }
    }

    /**
    * @dev Create a new pinned instance of an app linked to this kernel
    * @param _name Name of the app
    * @param _appBase Address of the app's base implementation
    * @return AppProxy instance
    */
    function newPinnedAppInstance(bytes32 _name, address _appBase) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
        return newPinnedAppInstance(_name, _appBase, false);
    }

    /**
    * @dev Create a new pinned instance of an app linked to this kernel and set
    *      its base implementation if it was not already set
    * @param _name Name of the app
    * @param _appBase Address of the app's base implementation
    * @param _setDefault Whether the app proxy app is the default one.
    *        Useful when the Kernel needs to know of an instance of a particular app,
    *        like Vault for escape hatch mechanism.
    * @return AppProxy instance
    */
    function newPinnedAppInstance(bytes32 _name, address _appBase, bool _setDefault) auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _name)) public returns (ERCProxy appProxy) {
        _setAppIfNew(APP_BASES_NAMESPACE, _name, _appBase);
        appProxy = newAppProxyPinned(this, _name);
        // By calling setApp directly and not the internal functions, we make sure the params are checked
        // and it will only succeed if sender has permissions to set something to the namespace.
        if (_setDefault) {
            setApp(APP_ADDR_NAMESPACE, _name, appProxy);
        }
    }

    /**
    * @dev Set the resolving address of an app instance or base implementation
    * @param _namespace App namespace to use
    * @param _name Name of the app
    * @param _app Address of the app
    * @return ID of app
    */
    function setApp(bytes32 _namespace, bytes32 _name, address _app) auth(APP_MANAGER_ROLE, arr(_namespace, _name)) kernelIntegrity public returns (bytes32 id) {
        return _setApp(_namespace, _name, _app);
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
    * @dev Get the address of the recovery Vault instance (to recover funds)
    * @return Address of the Vault
    */
    function getRecoveryVault() public view returns (address) {
        return apps[recoveryVaultId];
    }

    /**
    * @dev Set the default vault id for the escape hatch mechanism
    * @param _name Name of the app
    */
    function setRecoveryVaultId(bytes32 _name) auth(APP_MANAGER_ROLE, arr(APP_ADDR_NAMESPACE, _name)) public {
        recoveryVaultId = keccak256(APP_ADDR_NAMESPACE, _name);
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
        return acl().hasPermission(_who, _where, _what, _how);
    }

    function _setApp(bytes32 _namespace, bytes32 _name, address _app) internal returns (bytes32 id) {
        require(isContract(_app));
        id = keccak256(_namespace, _name);
        apps[id] = _app;
        SetApp(_namespace, _name, id, _app);
    }

    function _setAppIfNew(bytes32 _namespace, bytes32 _name, address _app) internal returns (bytes32 id) {
        require(isContract(_app));

        id = keccak256(_namespace, _name);

        address app = getApp(id);
        if (app != address(0)) {
            require(app == _app);
        } else {
            apps[id] = _app;
            SetApp(_namespace, _name, id, _app);
        }
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

    modifier kernelIntegrity {
        _; // After execution check integrity
        address kernel = getApp(KERNEL_APP);
        uint256 size;
        assembly { size := extcodesize(kernel) }
        require(size > 0);
    }
}
