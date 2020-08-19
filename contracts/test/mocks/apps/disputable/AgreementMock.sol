pragma solidity 0.4.24;

import "../../../../apps/disputable/IAgreement.sol";


contract AgreementMock is IAgreement {
    function newAction(uint256, bytes, address) external returns (uint256) {
        return 0;
    }

    function closeAction(uint256) external {
        // do nothing
    }

    function challengeAction(uint256, uint256, bool, bytes) external {
        // do nothing
    }

    function settleAction(uint256) external {
        // do nothing
    }

    function disputeAction(uint256, bool) external {
        // do nothing
    }
}
