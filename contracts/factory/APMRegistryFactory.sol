pragma solidity 0.4.18;


import "../apm/APMRegistry.sol";
import "../ens/ENSSubdomainRegistrar.sol";
import "../apps/AppProxyFactory.sol";

import "./DAOFactory.sol";
import "./ENSFactory.sol";


contract APMRegistryFactory is DAOFactory, APMRegistryConstants, AppProxyFactory {
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
    ) public
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

        dao.createPermission(this, dao, dao.UPGRADE_APPS_ROLE(), this);

        // App code for relevant apps
        dao.setAppCode(APM_APP_ID, registryBase);
        dao.setAppCode(REPO_APP_ID, repoBase);
        dao.setAppCode(ENS_SUB_APP_ID, ensSubdomainRegistrarBase);

        // Deploy proxies
        ENSSubdomainRegistrar ensSub = ENSSubdomainRegistrar(newAppProxy(dao, ENS_SUB_APP_ID));
        APMRegistry apm = APMRegistry(newAppProxy(dao, APM_APP_ID));

        // Grant permissions needed for APM on ENSSubdomainRegistrar
        dao.createPermission(apm, ensSub, ensSub.CREATE_NAME_ROLE(), _root);
        dao.createPermission(apm, ensSub, ensSub.POINT_ROOTNODE_ROLE(), _root);

        configureAPMPermissions(dao, apm, _root);

        // allow apm to create permissions for Repos in Kernel
        dao.grantPermission(apm, dao, dao.CREATE_PERMISSIONS_ROLE());

        // Permission transition to _root
        dao.setPermissionManager(_root, dao, dao.UPGRADE_APPS_ROLE());
        dao.revokePermission(this, dao, dao.CREATE_PERMISSIONS_ROLE());
        dao.grantPermission(_root, dao, dao.CREATE_PERMISSIONS_ROLE());
        dao.setPermissionManager(_root, dao, dao.CREATE_PERMISSIONS_ROLE());

        // Initialize
        ens.setOwner(node, ensSub);
        ensSub.initialize(ens, node);
        apm.initialize(ensSub);

        DeployAPM(node, apm);

        return apm;
    }

    // Factory can be subclassed and permissions changed
    function configureAPMPermissions(Kernel dao, APMRegistry apm, address root) internal {
        dao.createPermission(root, apm, apm.CREATE_REPO_ROLE(), root);
    }
}
