pragma solidity 0.4.24;


contract AgreementMock {
    function newAction(uint256 /* _disputableActionId */, bytes /* _context */, address /* _submitter */) external payable returns (uint256) {
        // do nothing
        return 0;
    }

    function closeAction(uint256 /* _actionId */) external {
        // do nothing
    }
}
