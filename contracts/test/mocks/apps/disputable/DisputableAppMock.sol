pragma solidity 0.4.24;

import "../../../../apps/disputable/DisputableAragonApp.sol";


contract DisputableAppMock is DisputableAragonApp {
    bytes4 public constant DISPUTABLE_INTERFACE = DISPUTABLE_INTERFACE_ID;

    event DisputableChallenged(uint256 indexed id);
    event DisputableAllowed(uint256 indexed id);
    event DisputableRejected(uint256 indexed id);
    event DisputableVoided(uint256 indexed id);

    function initialize() external {
        initialized();
    }

    function newAction(uint256 _disputableActionId, bytes _context, address _submitter) external {
        _registerDisputableAction(_disputableActionId, _context, _submitter);
    }

    function closeAction(uint256 _actionId) external {
        _closeDisputableAction(_actionId);
    }

    function canChallenge(uint256 /*_disputableActionId*/) external view returns (bool) {
        return true;
    }

    function canClose(uint256 /*_disputableActionId*/) external view returns (bool) {
        return true;
    }

    function interfaceID() external pure returns (bytes4) {
        IDisputable iDisputable;
        return iDisputable.setAgreement.selector ^
            iDisputable.onDisputableActionChallenged.selector ^
            iDisputable.onDisputableActionAllowed.selector ^
            iDisputable.onDisputableActionRejected.selector ^
            iDisputable.onDisputableActionVoided.selector ^
            iDisputable.getAgreement.selector ^
            iDisputable.canChallenge.selector ^
            iDisputable.canClose.selector;
    }

    /**
    * @dev Challenge an entry
    * @param _id Identifier of the entry to be challenged
    */
    function _onDisputableActionChallenged(uint256 _id, uint256 /* _challengeId */, address /* _challenger */) internal {
        emit DisputableChallenged(_id);
    }

    /**
    * @dev Allow an entry
    * @param _id Identifier of the entry to be allowed
    */
    function _onDisputableActionAllowed(uint256 _id) internal {
        emit DisputableAllowed(_id);
    }

    /**
    * @dev Reject an entry
    * @param _id Identifier of the entry to be rejected
    */
    function _onDisputableActionRejected(uint256 _id) internal {
        emit DisputableRejected(_id);
    }

    /**
    * @dev Void an entry
    * @param _id Identifier of the entry to be voided
    */
    function _onDisputableActionVoided(uint256 _id) internal {
        emit DisputableVoided(_id);
    }
}
