pragma solidity 0.4.24;

import "../../../apm/APMRegistry.sol";
import "../../../apm/Repo.sol";
import "../../../ens/ENSSubdomainRegistrar.sol";

import "../../../factory/DAOFactory.sol";
import "../../../factory/ENSFactory.sol";

// Mock that doesn't grant enough permissions
// Only usable with new ENS instance

contract APMRegistryFactoryMock is APMInternalAppNames {
    DAOFactory public daoFactory;
    APMRegistry public registryBase;
    Repo public repoBase;
    ENSSubdomainRegistrar public ensSubdomainRegistrarBase;
    ENS public ens;

    constructor(
        DAOFactory _daoFactory,
        APMRegistry _registryBase,
        Repo _repoBase,
        ENSSubdomainRegistrar _ensSubBase,
        ENSFactory _ensFactory
    ) public
    {
        daoFactory = _daoFactory;
        registryBase = _registryBase;
        repoBase = _repoBase;
        ensSubdomainRegistrarBase = _ensSubBase;
        ens = _ensFactory.newENS(this);
    }

    function newFailingAPM(
        bytes32 _tld,
        bytes32 _label,
        address _root,
        bool _withoutNameRole
    )
        public
        returns (APMRegistry)
    {
        // Set up ENS control
        bytes32 node = keccak256(abi.encodePacked(_tld, _label));
        ens.setSubnodeOwner(_tld, _label, this);

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

        // Grant permissions needed for APM on ENSSubdomainRegistrar
        acl.createPermission(apm, ensSub, ensSub.POINT_ROOTNODE_ROLE(), _root);

        // Don't grant all permissions needed for APM to initialize
        if (_withoutNameRole) {
            acl.createPermission(apm, ensSub, ensSub.CREATE_NAME_ROLE(), _root);
        }

        if (!_withoutNameRole) {
            bytes32 permRole = acl.CREATE_PERMISSIONS_ROLE();
            acl.grantPermission(apm, acl, permRole);
        }

        // Initialize
        ens.setOwner(node, ensSub);
        ensSub.initialize(ens, node);

        // This should fail since we haven't given all required permissions
        apm.initialize(ensSub);

        return apm;
    }
}
