pragma solidity ^0.4.24;

import "./AbstractENS.sol";


/**
 * A simple resolver anyone can use; only allows the owner of a node to set its
 * address.
 */
contract PublicResolver {
    bytes4 constant INTERFACE_META_ID = 0x01ffc9a7;
    bytes4 constant ADDR_INTERFACE_ID = 0x3b3b57de;
    bytes4 constant CONTENT_INTERFACE_ID = 0xd8389dc5;
    bytes4 constant NAME_INTERFACE_ID = 0x691f3431;
    bytes4 constant ABI_INTERFACE_ID = 0x2203ab56;
    bytes4 constant PUBKEY_INTERFACE_ID = 0xc8690233;
    bytes4 constant TEXT_INTERFACE_ID = 0x59d1d43c;

    event AddrChanged(bytes32 indexed node, address a);
    event ContentChanged(bytes32 indexed node, bytes32 hash);
    event NameChanged(bytes32 indexed node, string name);
    event ABIChanged(bytes32 indexed node, uint256 indexed contentType);
    event PubkeyChanged(bytes32 indexed node, bytes32 x, bytes32 y);
    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key);

    struct PublicKey {
        bytes32 x;
        bytes32 y;
    }

    struct Record {
        address addr;
        bytes32 content;
        string name;
        PublicKey pubkey;
        mapping(string=>string) text;
        mapping(uint256=>bytes) abis;
    }

    AbstractENS ens;
    mapping(bytes32=>Record) records;

    modifier only_owner(bytes32 node) {
        require(ens.owner(node) == msg.sender);
        _;
    }

    /**
     * Constructor.
     * @param ensAddr The ENS registrar contract.
     */
    constructor(AbstractENS ensAddr) public {
        ens = ensAddr;
    }

    /**
     * Returns true if the resolver implements the interface specified by the provided hash.
     * @param interfaceID The ID of the interface to check for.
     * @return True if the contract implements the requested interface.
     */
    function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
        return interfaceID == ADDR_INTERFACE_ID ||
               interfaceID == CONTENT_INTERFACE_ID ||
               interfaceID == NAME_INTERFACE_ID ||
               interfaceID == ABI_INTERFACE_ID ||
               interfaceID == PUBKEY_INTERFACE_ID ||
               interfaceID == TEXT_INTERFACE_ID ||
               interfaceID == INTERFACE_META_ID;
    }

    /**
     * Returns the address associated with an ENS node.
     * @param node The ENS node to query.
     * @return The associated address.
     */
    function addr(bytes32 node) public constant returns (address ret) {
        ret = records[node].addr;
    }

    /**
     * Sets the address associated with an ENS node.
     * May only be called by the owner of that node in the ENS registry.
     * @param _node The node to update.
     * @param _addr The address to set.
     */
    function setAddr(bytes32 _node, address _addr) only_owner(_node) public {
        records[_node].addr = _addr;
        emit AddrChanged(_node, _addr);
    }

    /**
     * Returns the content hash associated with an ENS node.
     * Note that this resource type is not standardized, and will likely change
     * in future to a resource type based on multihash.
     * @param _node The ENS node to query.
     * @return The associated content hash.
     */
    function content(bytes32 _node) public constant returns (bytes32 ret) {
        ret = records[_node].content;
    }

    /**
     * Sets the content hash associated with an ENS node.
     * May only be called by the owner of that node in the ENS registry.
     * Note that this resource type is not standardized, and will likely change
     * in future to a resource type based on multihash.
     * @param _node The node to update.
     * @param hash The content hash to set
     */
    function setContent(bytes32 _node, bytes32 hash) only_owner(_node) public {
        records[_node].content = hash;
        emit ContentChanged(_node, hash);
    }

    /**
     * Returns the name associated with an ENS node, for reverse records.
     * Defined in EIP181.
     * @param _node The ENS node to query.
     * @return The associated name.
     */
    function name(bytes32 _node) public constant returns (string ret) {
        ret = records[_node].name;
    }

    /**
     * Sets the name associated with an ENS node, for reverse records.
     * May only be called by the owner of that node in the ENS registry.
     * @param _node The node to update.
     * @param _name The name to set.
     */
    function setName(bytes32 _node, string _name) only_owner(_node) public {
        records[_node].name = _name;
        emit NameChanged(_node, _name);
    }

    /**
     * Returns the ABI associated with an ENS node.
     * Defined in EIP205.
     * @param _node The ENS node to query
     * @param _contentTypes A bitwise OR of the ABI formats accepted by the caller.
     * @return contentType The content type of the return value
     * @return data The ABI data
     */
    function ABI(bytes32 _node, uint256 _contentTypes) public constant returns (uint256 contentType, bytes data) {
        Record storage record = records[_node];
        for(contentType = 1; contentType <= _contentTypes; contentType <<= 1) {
            if ((contentType & _contentTypes) != 0 && record.abis[contentType].length > 0) {
                data = record.abis[contentType];
                return;
            }
        }
        contentType = 0;
    }

    /**
     * Sets the ABI associated with an ENS node.
     * Nodes may have one ABI of each content type. To remove an ABI, set it to
     * the empty string.
     * @param _node The node to update.
     * @param _contentType The content type of the ABI
     * @param _data The ABI data.
     */
    function setABI(bytes32 _node, uint256 _contentType, bytes _data) only_owner(_node) public {
        // Content types must be powers of 2
        require(((_contentType - 1) & _contentType) == 0);

        records[_node].abis[_contentType] = _data;
        emit ABIChanged(_node, _contentType);
    }

    /**
     * Returns the SECP256k1 public key associated with an ENS node.
     * Defined in EIP 619.
     * @param _node The ENS node to query
     * @return x, y the X and Y coordinates of the curve point for the public key.
     */
    function pubkey(bytes32 _node) public constant returns (bytes32 x, bytes32 y) {
        return (records[_node].pubkey.x, records[_node].pubkey.y);
    }

    /**
     * Sets the SECP256k1 public key associated with an ENS node.
     * @param _node The ENS node to query
     * @param _x the X coordinate of the curve point for the public key.
     * @param _y the Y coordinate of the curve point for the public key.
     */
    function setPubkey(bytes32 _node, bytes32 _x, bytes32 _y) only_owner(_node) public {
        records[_node].pubkey = PublicKey(_x, _y);
        emit PubkeyChanged(_node, _x, _y);
    }

    /**
     * Returns the text data associated with an ENS node and key.
     * @param _node The ENS node to query.
     * @param _key The text data key to query.
     * @return The associated text data.
     */
    function text(bytes32 _node, string _key) public constant returns (string ret) {
        ret = records[_node].text[_key];
    }

    /**
     * Sets the text data associated with an ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param _node The node to update.
     * @param _key The key to set.
     * @param _value The text data value to set.
     */
    function setText(bytes32 _node, string _key, string _value) only_owner(_node) public {
        records[_node].text[_key] = _value;
        emit TextChanged(_node, _key, _key);
    }
}
