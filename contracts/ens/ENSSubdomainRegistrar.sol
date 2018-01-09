pragma solidity ^0.4.0;

import "./AbstractENS.sol";
import "./PublicResolver.sol";

contract ENSSubdomainRegistrarConstants {
    bytes32 constant public ethTld = sha3(bytes32(0), sha3("eth"));
    bytes32 constant public publicResolverNode = sha3(ethTld, sha3("resolver"));
}

contract ENSSubdomainRegistrar is App, Initializable, ENSSubdomainRegistrarConstants {
    bytes32 constant public CREATE_NAME_ROLE = bytes32(1);
    bytes32 constant public DELETE_NAME_ROLE = bytes32(2);

    AbstractENS ens;
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

    function createName(bytes32 _label, address _owner) auth(CREATE_NAME_ROLE) external {
        _createName(_label, _owner);
    }

    function createNameAndPoint(bytes32 _label, address _target) auth(CREATE_NAME_ROLE) external {
        bytes32 node = _createName(_label, this);
        address publicResolver = getAddr(publicResolverNode);
        ens.setResolver(node, publicResolver);

        PublicResolver(publicResolver).setAddr(node, _target);
    }

    function deleteName(bytes32 _label) auth(DELETE_NAME_ROLE) external {
        bytes32 node = sha3(rootNode, _label);

        if (ens.owner(node) != address(this)) // needs to reclaim ownership so it can set resolver
            ens.setSubnodeOwner(rootNode, _label, this);

        ens.setResolver(node, address(0)); // remove resolver so it ends resolving
        ens.setOwner(node, address(0));

        DeleteName(node, _label);
    }

    function _createName(bytes32 _label, address _owner) internal returns (bytes32 node) {
        node = sha3(rootNode, _label);
        require(ens.owner(node) == address(0)); // avoid name reset

        ens.setSubnodeOwner(rootNode, _label, _owner);

        NewName(node, _label);
    }

    function getAddr(bytes32 node) internal view returns (address) {
        address resolver = ens.getResolver(node);
        return resolver.getAddr(node);
    }
}
