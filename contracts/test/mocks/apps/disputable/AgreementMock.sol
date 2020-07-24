pragma solidity 0.4.24;

import "../../../../apps/disputable/IAgreement.sol";


contract AgreementMock is IAgreement {
    function newAction(uint256 /* _disputableActionId */, bytes /* _context */, address /* _submitter */) external returns (uint256) {
        // do nothing
        return 0;
    }

    function closeAction(uint256 /* _actionId */) external {
        // do nothing
    }
}
