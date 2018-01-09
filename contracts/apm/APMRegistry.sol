pragma solidity 0.4.18;

import "../ens/AbstractENS.sol";
import "../zeppelin/lifecycle/Ownable.sol";
import "../ens/ENSSubdomainRegistrar.sol";
import "../apps/AppProxyFactory.sol";
import "../apps/App.sol";
import "../common/Initializable.sol";
import "./Repo.sol";


contract APMRegistryConstants {
    // Cant have a regular APM appId because it is used to build APM
    bytes32 constant public REPO_APP_ID = keccak256("repo");
}


contract APMRegistry is App, Initializable, AppProxyFactory, APMRegistryConstants {
    AbstractENS ens;
    ENSSubdomainRegistrar public registrar;

    bytes32 constant public CREATE_REPO_ROLE = bytes32(1);
    bytes32 constant public CREATE_VERSION_ROLE = bytes32(2);
    bytes32 constant public FREE_REPO_ROLE = bytes32(3);

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

        // Check we have permission to create names
        require((kernel == address(0)) || kernel.hasPermission(address(this), registrar, registrar.CREATE_NAME_ROLE()));
    }

    /**
    * @notice Create new repo in registry with `_name`
    * @param _name Repo name
    */
    function newRepo(string _name) auth(CREATE_REPO_ROLE) public returns (Repo) {
        return _newRepo(_name, this);
    }

    /**
    * @notice Create free new repo in registry with `_name` and owner `_owner`
    * @param _name Repo name
    * @param _owner Address that will own the repo
    */
    function newFreeRepo(string _name, address _owner) auth(CREATE_REPO_ROLE) auth(FREE_REPO_ROLE) public returns (Repo) {
        return _newRepo(_name, _owner);
    }

    /**
    * @notice Create new repo in registry with `_name` and first repo version
    * @param _name Repo name
    * @param _initialSemanticVersion Semantic version for new repo version
    * @param _contractAddress address for smart contract logic for version (if set to 0, it uses last versions' contractAddress)
    * @param _contentURI External URI for fetching new version's content
    */
    function newRepoWithVersion(
        string _name,
        uint16[3] _initialSemanticVersion,
        address _contractAddress,
        bytes _contentURI
    )
    auth(CREATE_REPO_ROLE) auth(CREATE_VERSION_ROLE)
    public
    returns (Repo)
    {
        Repo repo = _newRepo(_name, this);
        repo.newVersion(_initialSemanticVersion, _contractAddress, _contentURI);
        return repo;
    }

    /**
    * @notice Create new version in `_repo`
    * @param _repo Repo address
    * @param _semanticVersion Semantic version for the version
    * @param _contractAddress address for smart contract logic for version (if set to 0, it uses last versions' contractAddress)
    * @param _contentURI External URI for fetching new version's content
    */
    function newVersion(
        Repo _repo,
        uint16[3] _semanticVersion,
        address _contractAddress,
        bytes _contentURI
    )
    auth(CREATE_VERSION_ROLE)
    public
    {
        _repo.newVersion(_semanticVersion, _contractAddress, _contentURI);
    }

    /**
    * @notice Sets repo ownership to `_owner`, making the Registry lose all power
    * @param _repo Repo address
    * @param _owner New owner for repo
    */
    function freeRepo(Repo _repo, address _owner) auth(FREE_REPO_ROLE) public {
        _repo.transferOwnership(_owner);
    }

    function _newRepo(string _name, address _owner) internal returns (Repo) {
        Repo repo = newClonedRepo();
        repo.transferOwnership(_owner);

        // Creates [name] subdomain in the rootNode and sets registry as resolver
        // This will fail if repo name already exists
        bytes32 node = registrar.createNameAndPoint(keccak256(_name), repo);

        NewRepo(node, _name, repo);

        return repo;
    }

    function newClonedRepo() internal returns (Repo) {
        return Repo(newAppProxy(kernel, REPO_APP_ID));
    }
}
