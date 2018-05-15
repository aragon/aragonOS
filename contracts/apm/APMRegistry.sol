pragma solidity 0.4.18;

import "../lib/ens/AbstractENS.sol";
import "../ens/ENSSubdomainRegistrar.sol";
import "../factory/AppProxyFactory.sol";
import "../apps/AragonApp.sol";
import "../acl/ACL.sol";
import "./Repo.sol";


contract APMRegistryConstants {
    // Cant have a regular APM appId because it is used to build APM
    // TODO: recheck this
    string constant public APM_APP_NAME = "apm-registry";
    string constant public REPO_APP_NAME = "apm-repo";
    string constant public ENS_SUB_APP_NAME = "apm-enssub";
}


contract APMRegistry is AragonApp, AppProxyFactory, APMRegistryConstants {
    AbstractENS ens;
    ENSSubdomainRegistrar public registrar;

    // bytes32 constant public CREATE_REPO_ROLE = keccak256("CREATE_REPO_ROLE");
    bytes32 constant public CREATE_REPO_ROLE = 0x2a9494d64846c9fdbf0158785aa330d8bc9caf45af27fa0e8898eb4d55adcea6;

    event NewRepo(bytes32 id, string name, address repo);

    /**
    * NEEDS CREATE_NAME_ROLE and POINT_ROOTNODE_ROLE permissions on registrar
    * @param _registrar ENSSubdomainRegistrar instance that holds registry root node ownership
    */
    function initialize(ENSSubdomainRegistrar _registrar) onlyInit public {
        initialized();

        registrar = _registrar;
        ens = registrar.ens();

        registrar.pointRootNode(this);

        // Check APM has all permissions it needss
        ACL acl = ACL(kernel.acl());
        require(acl.hasPermission(this, registrar, registrar.CREATE_NAME_ROLE()));
        require(acl.hasPermission(this, acl, acl.CREATE_PERMISSIONS_ROLE()));
    }

    /**
    * @notice Create new repo in registry with `_name`
    * @param _name Repo name, must be ununsed
    * @param _dev Address that will be given permission to create versions
    */
    function newRepo(string _name, address _dev) auth(CREATE_REPO_ROLE) public returns (Repo) {
        return _newRepo(_name, _dev);
    }

    /**
    * @notice Create new repo in registry with `_name` and first repo version
    * @param _name Repo name
    * @param _dev Address that will be given permission to create versions
    * @param _initialSemanticVersion Semantic version for new repo version
    * @param _contractAddress address for smart contract logic for version (if set to 0, it uses last versions' contractAddress)
    * @param _contentURI External URI for fetching new version's content
    */
    function newRepoWithVersion(
        string _name,
        address _dev,
        uint16[3] _initialSemanticVersion,
        address _contractAddress,
        bytes _contentURI
    ) auth(CREATE_REPO_ROLE) public returns (Repo)
    {
        Repo repo = _newRepo(_name, this); // need to have permissions to create version
        repo.newVersion(_initialSemanticVersion, _contractAddress, _contentURI);

        // Give permissions to _dev
        ACL acl = ACL(kernel.acl());
        acl.revokePermission(this, repo, repo.CREATE_VERSION_ROLE());
        acl.grantPermission(_dev, repo, repo.CREATE_VERSION_ROLE());
        acl.setPermissionManager(_dev, repo, repo.CREATE_VERSION_ROLE());
        return repo;
    }

    function _newRepo(string _name, address _dev) internal returns (Repo) {
        require(bytes(_name).length > 0);

        Repo repo = newClonedRepo();

        ACL(kernel.acl()).createPermission(_dev, repo, repo.CREATE_VERSION_ROLE(), _dev);

        // Creates [name] subdomain in the rootNode and sets registry as resolver
        // This will fail if repo name already exists
        bytes32 node = registrar.createNameAndPoint(keccak256(_name), repo);

        NewRepo(node, _name, repo);

        return repo;
    }

    function newClonedRepo() internal returns (Repo) {
        return Repo(newAppProxy(kernel, repoAppId()));
    }

    function repoAppId() internal view returns (bytes32) {
        return keccak256(registrar.rootNode(), keccak256(REPO_APP_NAME));
    }
}
