pragma solidity 0.4.24;

// Mock that doesn't grant enough permissions
// external ENS

import "../../factory/APMRegistryFactory.sol";

contract APMRegistryFactoryMock is APMRegistryFactory {
    constructor(
        DAOFactory _daoFactory,
        APMRegistry _registryBase,
        Repo _repoBase,
        ENSSubdomainRegistrar _ensSubBase,
        ENS _ens,
        ENSFactory _ensFactory
    )
    APMRegistryFactory(_daoFactory, _registryBase, _repoBase, _ensSubBase, _ens, _ensFactory) public {}

    function newAPM(bytes32, bytes32, address) public returns (APMRegistry) {}

    function newBadAPM(bytes32 tld, bytes32 label, address _root, bool withoutACL) public returns (APMRegistry) {
        bytes32 node = keccak256(abi.encodePacked(tld, label));

        // Assume it is the test ENS
        if (ens.owner(node) != address(this)) {
            // If we weren't in test ens and factory doesn't have ownership, will fail
            ens.setSubnodeOwner(tld, label, this);
        }

        Kernel dao = daoFactory.newDAO(this);
        ACL acl = ACL(dao.acl());

        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        // Deploy app proxies
        bytes memory noInit = new bytes(0);
        ENSSubdomainRegistrar ensSub = ENSSubdomainRegistrar(
            dao.newAppInstance(
                keccak256(abi.encodePacked(node, keccak256(abi.encodePacked(ENS_SUB_APP_NAME)))),
                ensSubdomainRegistrarBase,
                noInit,
                false
            )
        );
        APMRegistry apm = APMRegistry(
            dao.newAppInstance(
                keccak256(abi.encodePacked(node, keccak256(abi.encodePacked(APM_APP_NAME)))),
                registryBase,
                noInit,
                false
            )
        );

        // APMRegistry controls Repos
        bytes32 repoAppId = keccak256(abi.encodePacked(node, keccak256(abi.encodePacked(REPO_APP_NAME))));
        dao.setApp(dao.APP_BASES_NAMESPACE(), repoAppId, repoBase);

        emit DeployAPM(node, apm);

        // Grant permissions needed for APM on ENSSubdomainRegistrar

        if (withoutACL) {
            acl.createPermission(apm, ensSub, ensSub.CREATE_NAME_ROLE(), _root);
        }

        acl.createPermission(apm, ensSub, ensSub.POINT_ROOTNODE_ROLE(), _root);

        configureAPMPermissions(acl, apm, _root);

        // allow apm to create permissions for Repos in Kernel
        bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();

        if (!withoutACL) {
            acl.grantPermission(apm, acl, permRole);
        }

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
}
