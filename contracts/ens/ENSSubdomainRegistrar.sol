pragma solidity 0.4.24;

import "../lib/ens/AbstractENS.sol";
import "../lib/ens/PublicResolver.sol";
import "./ENSConstants.sol";

import "../apps/AragonApp.sol";


/* solium-disable function-order */
// Allow public initialize() to be first
contract ENSSubdomainRegistrar is AragonApp, ENSConstants {
    /* Hardcoded constants to save gas
    bytes32 public constant CREATE_NAME_ROLE = keccak256("CREATE_NAME_ROLE");
    bytes32 public constant DELETE_NAME_ROLE = keccak256("DELETE_NAME_ROLE");
    bytes32 public constant POINT_ROOTNODE_ROLE = keccak256("POINT_ROOTNODE_ROLE");
    */
    bytes32 public constant CREATE_NAME_ROLE = 0xf86bc2abe0919ab91ef714b2bec7c148d94f61fdb069b91a6cfe9ecdee1799ba;
    bytes32 public constant DELETE_NAME_ROLE = 0x03d74c8724218ad4a99859bcb2d846d39999449fd18013dd8d69096627e68622;
    bytes32 public constant POINT_ROOTNODE_ROLE = 0x9ecd0e7bddb2e241c41b595a436c4ea4fd33c9fa0caa8056acf084fc3aa3bfbe;

    string private constant ERROR_NO_NODE_OWNERSHIP = "ENSSUB_NO_NODE_OWNERSHIP";
    string private constant ERROR_NAME_EXISTS = "ENSSUB_NAME_EXISTS";
    string private constant ERROR_NAME_DOESNT_EXIST = "ENSSUB_DOESNT_EXIST";

    AbstractENS public ens;
    bytes32 public rootNode;

    event NewName(bytes32 indexed node, bytes32 indexed label);
    event DeleteName(bytes32 indexed node, bytes32 indexed label);

    /**
    * @dev Initialize can only be called once. It saves the block number in which it was initialized. This contract must be the owner of the `_rootNode` node so that it can create subdomains.
    * @notice Initialize this ENSSubdomainRegistrar instance with `_ens` as the root ENS registry and `_rootNode` as the node to allocate subdomains under
    * @param _ens Address of ENS registry
    * @param _rootNode Node to allocate subdomains under
    */
    function initialize(AbstractENS _ens, bytes32 _rootNode) public onlyInit {
        initialized();

        // We need ownership to create subnodes
        require(_ens.owner(_rootNode) == address(this), ERROR_NO_NODE_OWNERSHIP);

        ens = _ens;
        rootNode = _rootNode;
    }

    /**
    * @notice Create a new ENS subdomain record for `_label` and assign ownership to `_owner`
    * @param _label Label of new subdomain
    * @param _owner Owner of new subdomain
    * @return node Hash of created node
    */
    function createName(bytes32 _label, address _owner) external auth(CREATE_NAME_ROLE) returns (bytes32 node) {
        return _createName(_label, _owner);
    }

    /**
    * @notice Create a new ENS subdomain record for `_label` that resolves to `_target` and is owned by this ENSSubdomainRegistrar
    * @param _label Label of new subdomain
    * @param _target Ethereum address this new subdomain label will point to
    * @return node Hash of created node
    */
    function createNameAndPoint(bytes32 _label, address _target) external auth(CREATE_NAME_ROLE) returns (bytes32 node) {
        node = _createName(_label, this);
        _pointToResolverAndResolve(node, _target);
    }

    /**
    * @notice Deregister ENS subdomain record for `_label`
    * @param _label Label of subdomain to deregister
    */
    function deleteName(bytes32 _label) external auth(DELETE_NAME_ROLE) {
        bytes32 node = getNodeForLabel(_label);

        address currentOwner = ens.owner(node);

        require(currentOwner != address(0), ERROR_NAME_DOESNT_EXIST); // fail if deleting unset name

        if (currentOwner != address(this)) { // needs to reclaim ownership so it can set resolver
            ens.setSubnodeOwner(rootNode, _label, this);
        }

        ens.setResolver(node, address(0)); // remove resolver so it ends resolving
        ens.setOwner(node, address(0));

        emit DeleteName(node, _label);
    }

    /**
    * @notice Resolve this ENSSubdomainRegistrar's root node to `_target`
    * @param _target Ethereum address root node will point to
    */
    function pointRootNode(address _target) external auth(POINT_ROOTNODE_ROLE) {
        _pointToResolverAndResolve(rootNode, _target);
    }

    function _createName(bytes32 _label, address _owner) internal returns (bytes32 node) {
        node = getNodeForLabel(_label);
        require(ens.owner(node) == address(0), ERROR_NAME_EXISTS); // avoid name reset

        ens.setSubnodeOwner(rootNode, _label, _owner);

        emit NewName(node, _label);

        return node;
    }

    function _pointToResolverAndResolve(bytes32 _node, address _target) internal {
        address publicResolver = getAddr(PUBLIC_RESOLVER_NODE);
        ens.setResolver(_node, publicResolver);

        PublicResolver(publicResolver).setAddr(_node, _target);
    }

    function getAddr(bytes32 node) internal view returns (address) {
        address resolver = ens.resolver(node);
        return PublicResolver(resolver).addr(node);
    }

    function getNodeForLabel(bytes32 _label) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(rootNode, _label));
    }
}
