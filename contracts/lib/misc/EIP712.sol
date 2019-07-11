pragma solidity ^0.4.24;


contract EIP712 {
    string private constant DOMAIN_TYPE = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(DOMAIN_TYPE);

    struct Domain {
        string  name;
        string  version;
        uint256 chainId;
        address verifyingContract;
    }

    function _domainSeparator() internal view returns (bytes32) {
        return _hash(Domain({
            name: _domainName(),
            version: _domainVersion(),
            chainId: _domainChainId(),
            verifyingContract: address(this)
        }));
    }

    function _hash(Domain domain) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes(domain.name)),
            keccak256(bytes(domain.version)),
            domain.chainId,
            domain.verifyingContract
        ));
    }

    function _domainName() internal view returns (string);
    function _domainVersion() internal view returns (string);
    function _domainChainId() internal view returns (uint256);
}
