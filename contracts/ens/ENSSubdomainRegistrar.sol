pragma solidity 0.4.18;

import "../lib/ens/AbstractENS.sol";
import "../lib/ens/PublicResolver.sol";
import "./ENSConstants.sol";

import "../apps/AragonApp.sol";


contract ENSSubdomainRegistrar is AragonApp, ENSConstants {
    // bytes32 constant public CREATE_NAME_ROLE = keccak256("CREATE_NAME_ROLE");
    // bytes32 constant public DELETE_NAME_ROLE = keccak256("DELETE_NAME_ROLE");
    // bytes32 constant public POINT_ROOTNODE_ROLE = keccak256("POINT_ROOTNODE_ROLE");
    bytes32 constant public CREATE_NAME_ROLE = 0xf86bc2abe0919ab91ef714b2bec7c148d94f61fdb069b91a6cfe9ecdee1799ba;
    bytes32 constant public DELETE_NAME_ROLE = 0x03d74c8724218ad4a99859bcb2d846d39999449fd18013dd8d69096627e68622;
    bytes32 constant public POINT_ROOTNODE_ROLE = 0x9ecd0e7bddb2e241c41b595a436c4ea4fd33c9fa0caa8056acf084fc3aa3bfbe;

    AbstractENS public ens;
    bytes32 public rootNode;

    event NewName(bytes32 indexed node, bytes32 indexed label);
    event DeleteName(bytes32 indexed node, bytes32 indexed label);

    function initialize(AbstractENS _ens, bytes32 _rootNode) onlyInit public {
        initialized();

        // We need ownership to create subnodes
        require(_ens.owner(_rootNode) == address(this));

        ens = _ens;
        rootNode = _rootNode;
    }

    function createName(bytes32 _label, address _owner) auth(CREATE_NAME_ROLE) external returns (bytes32 node) {
        return _createName(_label, _owner);
    }

    function createNameAndPoint(bytes32 _label, address _target) auth(CREATE_NAME_ROLE) external returns (bytes32 node) {
        node = _createName(_label, this);
        _pointToResolverAndResolve(node, _target);
    }

    function deleteName(bytes32 _label) auth(DELETE_NAME_ROLE) external {
        bytes32 node = keccak256(rootNode, _label);

        address currentOwner = ens.owner(node);

        require(currentOwner != address(0)); // fail if deleting unset name

        if (currentOwner != address(this)) { // needs to reclaim ownership so it can set resolver
            ens.setSubnodeOwner(rootNode, _label, this);
        }

        ens.setResolver(node, address(0)); // remove resolver so it ends resolving
        ens.setOwner(node, address(0));

        DeleteName(node, _label);
    }

    function pointRootNode(address _target) auth(POINT_ROOTNODE_ROLE) external {
        _pointToResolverAndResolve(rootNode, _target);
    }

    function _createName(bytes32 _label, address _owner) internal returns (bytes32 node) {
        node = keccak256(rootNode, _label);
        require(ens.owner(node) == address(0)); // avoid name reset

        ens.setSubnodeOwner(rootNode, _label, _owner);

        NewName(node, _label);
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
}
