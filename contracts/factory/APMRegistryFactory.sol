pragma solidity 0.4.18;


import "../apm/APMRegistry.sol";
import "../ens/ENSSubdomainRegistrar.sol";

import "./DAOFactory.sol";
import "./ENSFactory.sol";
import "./AppProxyFactory.sol";


contract APMRegistryFactory is APMRegistryConstants {
    DAOFactory public daoFactory;
    APMRegistry public registryBase;
    Repo public repoBase;
    ENSSubdomainRegistrar public ensSubdomainRegistrarBase;
    ENS public ens;

    event DeployAPM(bytes32 indexed node, address apm);

    // Needs either one ENS or ENSFactory
    function APMRegistryFactory(
        DAOFactory _daoFactory,
        APMRegistry _registryBase,
        Repo _repoBase,
        ENSSubdomainRegistrar _ensSubBase,
        ENS _ens,
        ENSFactory _ensFactory
    ) public // DAO initialized without evmscript run support
    {
        daoFactory = _daoFactory;
        registryBase = _registryBase;
        repoBase = _repoBase;
        ensSubdomainRegistrarBase = _ensSubBase;

        // Either the ENS address provided is used, if any.
        // Or we use the ENSFactory to generate a test instance of ENS
        // If not the ENS address nor factory address are provided, this will revert
        ens = _ens != address(0) ? _ens : _ensFactory.newENS(this);
    }

    function newAPM(bytes32 _tld, bytes32 _label, address _root) public returns (APMRegistry) {
        bytes32 node = keccak256(_tld, _label);

        // Assume it is the test ENS
        if (ens.owner(node) != address(this)) {
            // If we weren't in test ens and factory doesn't have ownership, will fail
            ens.setSubnodeOwner(_tld, _label, this);
        }

        Kernel dao = daoFactory.newDAO(this);
        ACL acl = ACL(dao.acl());

        acl.create(this, dao, dao.APP_MANAGER_ROLE(), this);

        bytes32 namespace = dao.APP_BASES_NAMESPACE();

        // Deploy app proxies
        ENSSubdomainRegistrar ensSub = ENSSubdomainRegistrar(dao.newAppInstance(keccak256(node, keccak256(ENS_SUB_APP_NAME)), ensSubdomainRegistrarBase));
        APMRegistry apm = APMRegistry(dao.newAppInstance(keccak256(node, keccak256(APM_APP_NAME)), registryBase));

        // APMRegistry controls Repos
        dao.setApp(namespace, keccak256(node, keccak256(REPO_APP_NAME)), repoBase);

        DeployAPM(node, apm);

        // Grant permissions needed for APM on ENSSubdomainRegistrar
        acl.create(apm, ensSub, ensSub.CREATE_NAME_ROLE(), _root);
        acl.create(apm, ensSub, ensSub.POINT_ROOTNODE_ROLE(), _root);

        // allow apm to create permissions for Repos in Kernel
        bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();

        acl.grant(apm, acl, permRole);

        // Initialize
        ens.setOwner(node, ensSub);
        ensSub.initialize(ens, node);
        apm.initialize(ensSub);

        uint16[3] memory firstVersion;
        firstVersion[0] = 1;

        acl.create(this, apm, apm.CREATE_REPO_ROLE(), this);

        apm.newRepoWithVersion(APM_APP_NAME, _root, firstVersion, registryBase, b("ipfs:apm"));
        apm.newRepoWithVersion(ENS_SUB_APP_NAME, _root, firstVersion, ensSubdomainRegistrarBase, b("ipfs:enssub"));
        apm.newRepoWithVersion(REPO_APP_NAME, _root, firstVersion, repoBase, b("ipfs:repo"));

        configureAPMPermissions(acl, apm, _root);

        // Permission transition to _root
        acl.setManager(_root, dao, dao.APP_MANAGER_ROLE());
        acl.revoke(this, acl, permRole);
        acl.grant(_root, acl, permRole);
        acl.setManager(_root, acl, permRole);

        return apm;
    }

    function b(string memory x) internal pure returns (bytes memory y) {
        y = bytes(x);
    }

    // Factory can be subclassed and permissions changed
    function configureAPMPermissions(ACL _acl, APMRegistry _apm, address _root) internal {
        _acl.grant(_root, _apm, _apm.CREATE_REPO_ROLE());
        _acl.setManager(_root, _apm, _apm.CREATE_REPO_ROLE());
    }
}
