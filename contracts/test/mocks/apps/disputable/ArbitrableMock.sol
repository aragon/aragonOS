pragma solidity ^0.4.24;

import "../../../../apps/disputable/IArbitrable.sol";


contract ArbitrableMock is IArbitrable {
    bytes4 public constant ERC165_INTERFACE = ERC165_INTERFACE_ID;
    bytes4 public constant ARBITRABLE_INTERFACE = ARBITRABLE_INTERFACE_ID;

    IArbitrator internal arbitrator;

    function submitEvidence(uint256 /* _disputeId */, bytes /* _evidence */, bool /* _finished */) external {
        // do nothing
    }

    function rule(uint256 /* _disputeId */, uint256 /* _ruling */) external {
        // do nothing
    }

    function interfaceID() external pure returns (bytes4) {
        IArbitrable iArbitrable;
        return iArbitrable.submitEvidence.selector ^ iArbitrable.rule.selector;
    }
}
