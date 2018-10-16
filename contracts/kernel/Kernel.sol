pragma solidity 0.4.24;

import "./IKernel.sol";
import "./KernelStorage.sol";
import "../acl/IACL.sol";
import "../acl/ACLSyntaxSugar.sol";
import "../lib/misc/ERCProxy.sol";
import "../common/IsContract.sol";
import "../common/Petrifiable.sol";
import "../common/VaultRecoverable.sol";
import "../factory/AppProxyFactory.sol";


contract Kernel is IKernel, KernelStorage, Petrifiable, IsContract, VaultRecoverable, AppProxyFactory, ACLSyntaxSugar {
    // Hardcode constant to save gas
    //bytes32 public constant APP_MANAGER_ROLE = keccak256("APP_MANAGER_ROLE");
    //bytes32 public constant DEFAULT_VAULT_APP_ID = apmNamehash("vault");
    bytes32 public constant APP_MANAGER_ROLE = 0xb6d92708f3d4817afc106147d969e229ced5c46e65e0a5002a0d391287762bd0;
    bytes32 public constant DEFAULT_VAULT_APP_ID = 0x7e852e0fcfce6551c13800f1e7476f982525c2b5277ba14b24339c68416336d1;

    string private constant ERROR_APP_NOT_CONTRACT = "KERNEL_APP_NOT_CONTRACT";
    string private constant ERROR_INVALID_APP_CHANGE = "KERNEL_INVALID_APP_CHANGE";
    string private constant ERROR_AUTH_FAILED = "KERNEL_AUTH_FAILED";

    /**
    * @dev Constructor that allows the deployer to choose if the base instance should be petrified immediately.
    * @param _shouldPetrify Immediately petrify this instance so that it can never be initialized
    */
    constructor(bool _shouldPetrify) public {
        if (_shouldPetrify) {
            petrify();
        }
    }

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized.
    * @notice Initializes a kernel instance along with its ACL and sets `_permissionsCreator` as the entity that can create other permissions
    * @param _baseAcl Address of base ACL app
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(IACL _baseAcl, address _permissionsCreator) public onlyInit {
        initialized();

        // Set ACL base
        _setApp(APP_BASES_NAMESPACE, ACL_APP_ID, _baseAcl);

        // Create ACL instance and attach it as the default ACL app
        IACL acl = IACL(newAppProxy(this, ACL_APP_ID));
        acl.initialize(_permissionsCreator);
        _setApp(APP_ADDR_NAMESPACE, ACL_APP_ID, acl);

        recoveryVaultAppId = DEFAULT_VAULT_APP_ID;
    }

    /**
    * @dev Create a new instance of an app linked to this kernel
    * @notice Create a new upgradeable instance of `_appId` app linked to the Kernel, setting its code to `_appBase`
    * @param _appId Identifier for app
    * @param _appBase Address of the app's base implementation
    * @return AppProxy instance
    */
    function newAppInstance(bytes32 _appId, address _appBase)
        public
        auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    {
        return newAppInstance(_appId, _appBase, new bytes(0), false);
    }

    /**
    * @dev Create a new instance of an app linked to this kernel and set its base
    *      implementation if it was not already set
    * @notice Create a new upgradeable instance of `_appId` app linked to the Kernel, setting its code to `_appBase`. `_setDefault ? 'Also sets it as the default app instance.':''`
    * @param _appId Identifier for app
    * @param _appBase Address of the app's base implementation
    * @param _initializePayload Payload for call made by the proxy during its construction to initialize
    * @param _setDefault Whether the app proxy app is the default one.
    *        Useful when the Kernel needs to know of an instance of a particular app,
    *        like Vault for escape hatch mechanism.
    * @return AppProxy instance
    */
    function newAppInstance(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault)
        public
        auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    {
        _setAppIfNew(APP_BASES_NAMESPACE, _appId, _appBase);
        appProxy = newAppProxy(this, _appId, _initializePayload);
        // By calling setApp directly and not the internal functions, we make sure the params are checked
        // and it will only succeed if sender has permissions to set something to the namespace.
        if (_setDefault) {
            setApp(APP_ADDR_NAMESPACE, _appId, appProxy);
        }
    }

    /**
    * @dev Create a new pinned instance of an app linked to this kernel
    * @notice Create a new non-upgradeable instance of `_appId` app linked to the Kernel, setting its code to `_appBase`.
    * @param _appId Identifier for app
    * @param _appBase Address of the app's base implementation
    * @return AppProxy instance
    */
    function newPinnedAppInstance(bytes32 _appId, address _appBase)
        public
        auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    {
        return newPinnedAppInstance(_appId, _appBase, new bytes(0), false);
    }

    /**
    * @dev Create a new pinned instance of an app linked to this kernel and set
    *      its base implementation if it was not already set
    * @notice Create a new non-upgradeable instance of `_appId` app linked to the Kernel, setting its code to `_appBase`. `_setDefault ? 'Also sets it as the default app instance.':''`
    * @param _appId Identifier for app
    * @param _appBase Address of the app's base implementation
    * @param _initializePayload Payload for call made by the proxy during its construction to initialize
    * @param _setDefault Whether the app proxy app is the default one.
    *        Useful when the Kernel needs to know of an instance of a particular app,
    *        like Vault for escape hatch mechanism.
    * @return AppProxy instance
    */
    function newPinnedAppInstance(bytes32 _appId, address _appBase, bytes _initializePayload, bool _setDefault)
        public
        auth(APP_MANAGER_ROLE, arr(APP_BASES_NAMESPACE, _appId))
        returns (ERCProxy appProxy)
    {
        _setAppIfNew(APP_BASES_NAMESPACE, _appId, _appBase);
        appProxy = newAppProxyPinned(this, _appId, _initializePayload);
        // By calling setApp directly and not the internal functions, we make sure the params are checked
        // and it will only succeed if sender has permissions to set something to the namespace.
        if (_setDefault) {
            setApp(APP_ADDR_NAMESPACE, _appId, appProxy);
        }
    }

    /**
    * @dev Set the resolving address of an app instance or base implementation
    * @notice Set the resolving address of `_appId` in namespace `_namespace` to `_app`
    * @param _namespace App namespace to use
    * @param _appId Identifier for app
    * @param _app Address of the app instance or base implementation
    * @return ID of app
    */
    function setApp(bytes32 _namespace, bytes32 _appId, address _app)
        public
        auth(APP_MANAGER_ROLE, arr(_namespace, _appId))
    {
        _setApp(_namespace, _appId, _app);
    }

    /**
    * @dev Set the default vault id for the escape hatch mechanism
    * @param _recoveryVaultAppId Identifier of the recovery vault app
    */
    function setRecoveryVaultAppId(bytes32 _recoveryVaultAppId)
        public
        auth(APP_MANAGER_ROLE, arr(APP_ADDR_NAMESPACE, _recoveryVaultAppId))
    {
        recoveryVaultAppId = _recoveryVaultAppId;
    }

    /**
    * @dev Get the address of an app instance or base implementation
    * @param _namespace App namespace to use
    * @param _appId Identifier for app
    * @return Address of the app
    */
    function getApp(bytes32 _namespace, bytes32 _appId) public view returns (address) {
        return apps[_namespace][_appId];
    }

    /**
    * @dev Get the address of the recovery Vault instance (to recover funds)
    * @return Address of the Vault
    */
    function getRecoveryVault() public view returns (address) {
        return apps[APP_ADDR_NAMESPACE][recoveryVaultAppId];
    }

    /**
    * @dev Get the installed ACL app
    * @return ACL app
    */
    function acl() public view returns (IACL) {
        return IACL(getApp(APP_ADDR_NAMESPACE, ACL_APP_ID));
    }

    /**
    * @dev Function called by apps to check ACL on kernel or to check permission status
    * @param _who Sender of the original call
    * @param _where Address of the app
    * @param _what Identifier for a group of actions in app
    * @param _how Extra data for ACL auth
    * @return Boolean indicating whether the ACL allows the role or not.
    *         Always returns false if the kernel hasn't been initialized yet.
    */
    function hasPermission(address _who, address _where, bytes32 _what, bytes _how) public view returns (bool) {
        IACL defaultAcl = acl();
        return address(defaultAcl) != address(0) && // Poor man's initialization check (saves gas)
            defaultAcl.hasPermission(_who, _where, _what, _how);
    }

    function _setApp(bytes32 _namespace, bytes32 _appId, address _app) internal {
        require(isContract(_app), ERROR_APP_NOT_CONTRACT);
        apps[_namespace][_appId] = _app;
        emit SetApp(_namespace, _appId, _app);
    }

    function _setAppIfNew(bytes32 _namespace, bytes32 _appId, address _app) internal {
        address app = getApp(_namespace, _appId);
        if (app != address(0)) {
            // The only way to set an app is if it passes the isContract check, so no need to check it again
            require(app == _app, ERROR_INVALID_APP_CHANGE);
        } else {
            _setApp(_namespace, _appId, _app);
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
        require(hasPermission(msg.sender, address(this), _role, how), ERROR_AUTH_FAILED);
        _;
    }
}
