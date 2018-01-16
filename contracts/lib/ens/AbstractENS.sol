pragma solidity ^0.4.15;


interface AbstractENS {
    function owner(bytes32 _node) constant returns (address);
    function resolver(bytes32 _node) constant returns (address);
    function ttl(bytes32 _node) constant returns (uint64);
    function setOwner(bytes32 _node, address _owner);
    function setSubnodeOwner(bytes32 _node, bytes32 label, address _owner);
    function setResolver(bytes32 _node, address _resolver);
    function setTTL(bytes32 _node, uint64 _ttl);

    // Logged when the owner of a node assigns a new owner to a subnode.
    event NewOwner(bytes32 indexed _node, bytes32 indexed _label, address _owner);

    // Logged when the owner of a node transfers ownership to a new account.
    event Transfer(bytes32 indexed _node, address _owner);

    // Logged when the resolver for a node changes.
    event NewResolver(bytes32 indexed _node, address _resolver);

    // Logged when the TTL of a node changes
    event NewTTL(bytes32 indexed _node, uint64 _ttl);
}
