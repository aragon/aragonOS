pragma solidity ^0.4.24;

import "../../../../lib/arbitration/IArbitrable.sol";
import "../../../../lib/arbitration/IArbitrator.sol";


contract ArbitrableMock is IArbitrable {
    bytes4 public constant ERC165_INTERFACE = ERC165_INTERFACE_ID;
    bytes4 public constant ARBITRABLE_INTERFACE = ARBITRABLE_INTERFACE_ID;

    function interfaceId() external pure returns (bytes4) {
        IArbitrable iArbitrable;
        return iArbitrable.submitEvidence.selector ^ iArbitrable.rule.selector;
    }
}
