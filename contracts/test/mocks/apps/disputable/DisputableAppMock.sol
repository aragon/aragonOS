pragma solidity 0.4.24;

import "../../../../apps/disputable/DisputableApp.sol";


contract DisputableAppMock is DisputableApp {
    bytes4 public constant ERC165_INTERFACE = ERC165_INTERFACE_ID;
    bytes4 public constant DISPUTABLE_INTERFACE = DISPUTABLE_INTERFACE_ID;

    event DisputableSubmitted(uint256 indexed id);
    event DisputableChallenged(uint256 indexed id);
    event DisputableAllowed(uint256 indexed id);
    event DisputableRejected(uint256 indexed id);
    event DisputableVoided(uint256 indexed id);
    event DisputableClosed(uint256 indexed id);

    uint64 public entryLifetime;
    uint256 private entriesLength;
    mapping (uint256 => uint256) private actionsByEntryId;

    /**
    * @notice Compute Disputable interface ID
    */
    function interfaceId() external pure returns (bytes4) {
        IDisputable iDisputable;
        return iDisputable.setAgreement.selector ^
        iDisputable.onDisputableActionChallenged.selector ^
        iDisputable.onDisputableActionAllowed.selector ^
        iDisputable.onDisputableActionRejected.selector ^
        iDisputable.onDisputableActionVoided.selector ^
        iDisputable.getAgreement.selector;
    }

    /**
    * @dev Initialize app
    */
    function initialize() external {
        initialized();
    }

    /**
    * @dev Set entry lifetime duration
    */
    function setLifetime(uint64 _lifetime) external {
        entryLifetime = _lifetime;
    }

    /**
    * @dev Close action
    */
    function closeAction(uint256 _id) public {
        _closeAgreementAction(actionsByEntryId[_id]);
        emit DisputableClosed(_id);
    }

    /**
    * @dev IForwarder interface conformance
    */
    function forward(bytes memory _data) public {
        uint256 id = entriesLength++;
        actionsByEntryId[id] = _newAgreementAction(id, entryLifetime, msg.sender, _data);
        emit DisputableSubmitted(id);
    }

    /**
    * @notice Tells whether `msg.sender` can forward actions or not
    * @dev IForwarder interface conformance
    * @return Always true
    */
    function canForward(address /* _sender */, bytes /* _data */) public view returns (bool) {
        return true;
    }

    /**
    * @dev Challenge an entry
    * @param _id Identification number of the entry to be challenged
    */
    function _onDisputableActionChallenged(uint256 _id, uint256 /* _challengeId */, address /* _challenger */) internal {
        emit DisputableChallenged(_id);
    }

    /**
    * @dev Allow an entry
    * @param _id Identification number of the entry to be allowed
    */
    function _onDisputableActionAllowed(uint256 _id) internal {
        emit DisputableAllowed(_id);
    }

    /**
    * @dev Reject an entry
    * @param _id Identification number of the entry to be rejected
    */
    function _onDisputableActionRejected(uint256 _id) internal {
        emit DisputableRejected(_id);
    }

    /**
    * @dev Void an entry
    * @param _id Identification number of the entry to be voided
    */
    function _onDisputableActionVoided(uint256 _id) internal {
        emit DisputableVoided(_id);
    }
}
