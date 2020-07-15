pragma solidity 0.4.24;


contract AgreementMock {
    string internal constant ERROR_ACTION_DOES_NOT_EXIST = "AGR_ACTION_DOES_NOT_EXIST";
    string internal constant ERROR_ACTION_ALREADY_CLOSED = "AGR_ACTION_ALREADY_CLOSED";

    event NewAction(uint256 disputableActionId, bytes context, address submitter);
    event CloseAction(uint256 actionId);

    uint256 internal actionsLength;
    mapping (uint256 => bool) internal actionClosed;

    function newAction(uint256 _disputableActionId, bytes _context, address _submitter) external payable returns (uint256) {
        emit NewAction(_disputableActionId, _context, _submitter);
        return actionsLength++;
    }

    function closeAction(uint256 _actionId) external {
        require(_actionId < actionsLength, ERROR_ACTION_DOES_NOT_EXIST);
        require(!actionClosed[_actionId], ERROR_ACTION_ALREADY_CLOSED);
        actionClosed[_actionId] = true;
        emit CloseAction(_actionId);
    }

    function getAction(uint256 _actionId)
        external
        view
        returns (address, uint256, uint256, uint256, address, bool closed, bytes, uint256)
    {
        require(_actionId < actionsLength, ERROR_ACTION_DOES_NOT_EXIST);
        closed = actionClosed[_actionId];
    }
}
