pragma solidity 0.4.18;

import "./IKernel.sol";
import "./ACLSyntaxSugar.sol";


interface ACLOracle {
    function canPerform(address who, address where, bytes32 what) public view returns (bool);
}


contract ACL is ACLEvents, ACLSyntaxSugar {
    bytes32 constant public CREATE_PERMISSIONS_ROLE = bytes32(1);

    // whether a certain entity has a permission
    mapping (bytes32 => bytes32) permissions; // 0 for no permission, or parameters id
    mapping (bytes32 => Param[]) public permissionParams;

    // who is the manager of a permission
    mapping (bytes32 => address) permissionManager;
    // appId -> implementation

    enum Op { none, eq, neq, gt, lt, gte, lte, and, or, xor } // comparaison types

    struct Param {
        uint8 id;
        uint8 op;
        uint240 value; // even though value is an uint240 it can store addresses
        // in the case of 32 byte hashes losing 2 bytes precision isn't a huge deal
        // op and id take has 1 byte each so it can be kept in 1 sstore
    }

    uint8 constant BLOCK_NUMBER_PARAM_ID = 200;
    uint8 constant TIMESTAMP_PARAM_ID    = 201;
    uint8 constant SENDER_PARAM_ID       = 202;
    uint8 constant ORACLE_PARAM_ID       = 203;
    // TODO: Add execution times param type?

    bytes32 constant public EMPTY_PARAM_HASH = keccak256(uint256(0));
    address constant ANY_ENTITY = address(-1);

    modifier onlyPermissionManager(address app, bytes32 role) {
        require(msg.sender == getPermissionManager(app, role));
        _;
    }

    modifier auth(bytes32 _role) {
        require(hasPermission(msg.sender, address(this), _role));
        _;
    }

    modifier authP(bytes32 _role, uint256[] _args) {
        require(hasPermission(msg.sender, address(this), _role, _args));
        _;
    }

    /**
    * @dev Initialize will only be called once.
    * @notice Initializes setting `_permissionsCreator` as the entity that can create other permissions
    * @param _permissionsCreator Entity that will be given permission over createPermission
    */
    function initialize(address _permissionsCreator) public {
        // Superclass needs to take care that this can only be called once
        _createPermission(
            _permissionsCreator,
            address(this),
            CREATE_PERMISSIONS_ROLE,
            _permissionsCreator
        );
    }

    /**
    * @dev Creates a permission that wasn't previously set. Access is limited by the ACL.
    *      If a created permission is removed it is possible to reset it with createPermission.
    * @notice Create a new permission granting `_entity` the ability to perform actions of role `_role` on `_app` (setting `_manager` as parent)
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _manager Address of the entity that will be able to grant and revoke the permission further.
    */
    function createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _manager
    )
        auth(CREATE_PERMISSIONS_ROLE)
        external
    {
        _createPermission(
            _entity,
            _app,
            _role,
            _manager
        );
    }

    /**
    * @dev Grants a permission if allowed. This requires `msg.sender` to be the permission manager
    * @notice Grants `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function grantPermission(address _entity, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        grantPermissionP(_entity, _app, _role, new uint256[](0));
    }

    /**
    * @dev Grants a permission if allowed. This requires `msg.sender` to be the permission manager
    * @notice Grants `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be able to perform the role
    * @param _app Address of the app in which the role will be allowed (requires app to depend on kernel for ACL)
    * @param _role Identifier for the group of actions in app given access to perform
    * @param _params Permission parameters
    */
    function grantPermissionP(address _entity, address _app, bytes32 _role, uint256[] _params)
        onlyPermissionManager(_app, _role)
        public
    {
        require(!hasPermission(_entity, _app, _role));
        bytes32 paramsHash = _params.length > 0 ? _saveParams(_params) : EMPTY_PARAM_HASH;
        _setPermission(
            _entity,
            _app,
            _role,
            paramsHash
        );
    }

    /**
    * @dev Revokes permission if allowed. This requires `msg.sender` to be the parent of the permission
    * @notice Revokes `_entity` the ability to perform actions of role `_role` on `_app`
    * @param _entity Address of the whitelisted entity that will be revoked access
    * @param _app Address of the app in which the role is revoked
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function revokePermission(address _entity, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        require(hasPermission(_entity, _app, _role));
        _setPermission(
            _entity,
            _app,
            _role,
            bytes32(0)
        );
    }

    /**
    * @notice Sets `_newManager` as the manager of the permission `_role` in `_app`
    * @param _newManager Address for the new manager
    * @param _app Address of the app in which the permission management is being transferred
    * @param _role Identifier for the group of actions in app given access to perform
    */
    function setPermissionManager(address _newManager, address _app, bytes32 _role)
        onlyPermissionManager(_app, _role)
        external
    {
        _setPermissionManager(_newManager, _app, _role);
    }

    /**
    * @dev Get manager address for permission
    * @param _app Address of the app
    * @param _role Identifier for a group of actions in app
    * @return address of the manager for the permission
    */
    function getPermissionManager(address _app, bytes32 _role) view public returns (address) {
        return permissionManager[roleHash(_app, _role)];
    }

    /**
    * @dev Function called by apps to check ACL on kernel or to check permission statu
    * @param who Sender of the original call
    * @param where Address of the app
    * @param where Identifier for a group of actions in app
    * @return boolean indicating whether the ACL allows the role or not
    */
    function hasPermission(address who, address where, bytes32 what) view public returns (bool) {
        uint256[] memory empty = new uint256[](0);
        return hasPermission(who, where, what, empty);
    }

    /**
    * @dev Internal createPermission for access inside the kernel (on instantiation)
    */
    function _createPermission(
        address _entity,
        address _app,
        bytes32 _role,
        address _manager
    )
        internal
    {
        // only allow permission creation when it has no manager (hasn't been created before)
        require(getPermissionManager(_app, _role) == address(0));

        _setPermission(
            _entity,
            _app,
            _role,
            EMPTY_PARAM_HASH
        );
        _setPermissionManager(_manager, _app, _role);
    }

    /**
    * @dev Internal function called to actually save the permission
    */
    function _setPermission(
        address _entity,
        address _app,
        bytes32 _role,
        bytes32 _paramsHash
    )
        internal
    {
        permissions[permissionHash(_entity, _app, _role)] = _paramsHash;

        SetPermission(
            _entity,
            _app,
            _role,
            _paramsHash != bytes32(0)
        );
    }

    function _saveParams(uint256[] encodedParams) internal returns (bytes32) {
        bytes32 paramHash = keccak256(encodedParams);
        Param[] storage params = permissionParams[paramHash];

        if (params.length == 0) { // params not saved before
            for (uint256 i = 0; i < encodedParams.length; i++) {
                uint256 encodedParam = encodedParams[i];
                Param memory param = Param(decodeParamId(encodedParam), decodeParamOp(encodedParam), uint240(encodedParam));
                params.push(param);
            }
        }

        return paramHash;
    }

    function hasPermission(address who, address where, bytes32 what, uint256[] memory how) view public returns (bool) {
        bytes32 whoParams = permissions[permissionHash(who, where, what)];
        bytes32 anyParams = permissions[permissionHash(ANY_ENTITY, where, what)];

        if (whoParams != bytes32(0) && evalParams(whoParams, who, where, what, how)) {        // solium-disable-line arg-overflow
            return true;
        }

        if (anyParams != bytes32(0) && evalParams(anyParams, ANY_ENTITY, where, what, how)) { // solium-disable-line arg-overflow
            return true;
        }

        return false;
    }

    function evalParams(
        bytes32 paramsHash,
        address who,
        address where,
        bytes32 what,
        uint256[] how
    ) internal view returns (bool)
    {
        if (paramsHash == EMPTY_PARAM_HASH) {
            return true;
        }

        Param[] memory params = permissionParams[paramsHash];

        for (uint256 i = 0; i < params.length; i++) {
            bool success = evalParam(params[i], who, where, what, how); // solium-disable-line arg-overflow
            if (!success) {
                return false;
            }
        }

        return true;
    }

    function evalParam(
        Param param,
        address who,
        address where,
        bytes32 what,
        uint256[] how
    ) internal view returns (bool)
    {
        uint256 value;
        uint256 comparedTo = uint256(param.value);

        if (param.id == ORACLE_PARAM_ID) {
            value = ACLOracle(param.value).canPerform(who, where, what) ? 1 : 0;
            comparedTo = 1;
        } else if (param.id == BLOCK_NUMBER_PARAM_ID) {
            value = blockN();
        } else if (param.id == TIMESTAMP_PARAM_ID) {
            value = time();
        } else if (param.id == SENDER_PARAM_ID) {
            value = uint256(msg.sender);
        } else {
            if (param.id >= how.length) {
                return false;
            }
            value = uint256(uint240(how[param.id])); // force lost precision
        }

        return compare(value, Op(param.op), comparedTo);
    }

    function compare(uint256 a, Op op, uint256 b) internal pure returns (bool) {
        if (op == Op.eq)  return a == b;                              // solium-disable-line lbrace
        if (op == Op.neq) return a != b;                              // solium-disable-line lbrace
        if (op == Op.gt)  return a > b;                               // solium-disable-line lbrace
        if (op == Op.lt)  return a < b;                               // solium-disable-line lbrace
        if (op == Op.gte) return a >= b;                              // solium-disable-line lbrace
        if (op == Op.lte) return a <= b;                              // solium-disable-line lbrace
        if (op == Op.and) return a > 0 && b > 0;                      // solium-disable-line lbrace
        if (op == Op.or)  return a > 0 || b > 0;                      // solium-disable-line lbrace
        if (op == Op.xor) return a > 0 && b == 0 || a == 0 && b > 0;  // solium-disable-line lbrace
        return false;
    }

    /**
    * @dev Internal function that sets management
    */
    function _setPermissionManager(address _newManager, address _app, bytes32 _role) internal {
        require(_newManager > 0);

        permissionManager[roleHash(_app, _role)] = _newManager;
        ChangePermissionManager(_app, _role, _newManager);
    }

    function roleHash(address where, bytes32 what) pure internal returns (bytes32) {
        return keccak256(uint256(1), where, what);
    }

    function permissionHash(address who, address where, bytes32 what) pure internal returns (bytes32) {
        return keccak256(uint256(2), who, where, what);
    }

    function time() internal view returns (uint64) { return uint64(block.timestamp); } // solium-disable-line security/no-block-members

    function blockN() internal view returns (uint256) { return block.number; }
}
