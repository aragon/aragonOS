pragma solidity 0.4.24;

import "../../../ens/ENSConstants.sol";


contract ENSConstantsMock is ENSConstants {
    function getEnsRoot() external pure returns (bytes32) { return ENS_ROOT; }
    function getEthTldLabel() external pure returns (bytes32) { return ETH_TLD_LABEL; }
    function getEthTldNode() external pure returns (bytes32) { return ETH_TLD_NODE; }
    function getPublicResolverLabel() external pure returns (bytes32) { return PUBLIC_RESOLVER_LABEL; }
    function getPublicResolverNode() external pure returns (bytes32) { return PUBLIC_RESOLVER_NODE; }
}
