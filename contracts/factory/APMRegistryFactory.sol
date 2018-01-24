pragma solidity 0.4.18;


import "../apm/APMRegistry.sol";
import "../ens/ENSSubdomainRegistrar.sol";

import "./DAOFactory.sol";
import "./ENSFactory.sol";
import "./AppProxyFactory.sol";


contract APMRegistryFactory is DAOFactory, APMRegistryConstants {
    APMRegistry public registryBase;
    Repo public repoBase;
    ENSSubdomainRegistrar public ensSubdomainRegistrarBase;
    ENS public ens;

    event DeployAPM(bytes32 indexed node, address apm);

    // Needs either one ENS or ENSFactory
    function APMRegistryFactory(
        APMRegistry _registryBase,
        Repo _repoBase,
        ENSSubdomainRegistrar _ensSubBase,
        ENS _ens,
        ENSFactory _ensFactory
    ) DAOFactory(address(0)) public // DAO initialized without evmscript run support
    {
        registryBase = _registryBase;
        repoBase = _repoBase;
        ensSubdomainRegistrarBase = _ensSubBase;

        // Either the ENS address provided is used, if any.
        // Or we use the ENSFactory to generate a test instance of ENS
        // If not the ENS address nor factory address are provided, this will revert
        ens = _ens != address(0) ? _ens : _ensFactory.newENS(this);
    }

    function newAPM(bytes32 tld, bytes32 label, address _root) public returns (APMRegistry) {
        bytes32 node = keccak256(tld, label);

        // Assume it is the test ENS
        if (ens.owner(node) != address(this)) {
            // If we weren't in test ens and factory doesn't have ownership, will fail
            ens.setSubnodeOwner(tld, label, this);
        }

        Kernel dao = newDAO(this);
        ACL acl = ACL(dao.acl());

        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        bytes32 namespace = dao.APP_BASES_NAMESPACE();

        // App code for relevant apps
        dao.setApp(namespace, APM_APP_ID, registryBase);
        dao.setApp(namespace, REPO_APP_ID, repoBase);
        dao.setApp(namespace, ENS_SUB_APP_ID, ensSubdomainRegistrarBase);

        // Deploy proxies
        ENSSubdomainRegistrar ensSub = ENSSubdomainRegistrar(newAppProxy(dao, ENS_SUB_APP_ID));
        APMRegistry apm = APMRegistry(newAppProxy(dao, APM_APP_ID));

        DeployAPM(node, apm);

        // Grant permissions needed for APM on ENSSubdomainRegistrar
        acl.createPermission(apm, ensSub, ensSub.CREATE_NAME_ROLE(), _root);
        acl.createPermission(apm, ensSub, ensSub.POINT_ROOTNODE_ROLE(), _root);

        configureAPMPermissions(acl, apm, _root);

        // allow apm to create permissions for Repos in Kernel
        bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();

        acl.grantPermission(apm, acl, permRole);

        // Permission transition to _root
        acl.setPermissionManager(_root, dao, dao.APP_MANAGER_ROLE());
        acl.revokePermission(this, acl, permRole);
        acl.grantPermission(_root, acl, permRole);
        acl.setPermissionManager(_root, acl, permRole);

        // Initialize
        ens.setOwner(node, ensSub);
        ensSub.initialize(ens, node);
        apm.initialize(ensSub);

        return apm;
    }

    // Factory can be subclassed and permissions changed
    function configureAPMPermissions(ACL acl, APMRegistry apm, address root) internal {
        acl.createPermission(root, apm, apm.CREATE_REPO_ROLE(), root);
    }
}
