/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../../lib/token/ERC20.sol";


contract IAgreement {

    event ActionSubmitted(uint256 indexed actionId, address indexed disputable);
    event ActionClosed(uint256 indexed actionId);
    event ActionChallenged(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionSettled(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionDisputed(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionAccepted(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionVoided(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionRejected(uint256 indexed actionId, uint256 indexed challengeId);

    enum ChallengeState {
        Waiting,
        Settled,
        Disputed,
        Rejected,
        Accepted,
        Voided
    }

    function newAction(uint256 _disputableActionId, bytes _context, address _submitter) external returns (uint256);

    function closeAction(uint256 _actionId) external;

    function challengeAction(uint256 _actionId, uint256 _settlementOffer, bool _finishedSubmittingEvidence, bytes _context) external;

    function settleAction(uint256 _actionId) external;

    function disputeAction(uint256 _actionId, bool _finishedSubmittingEvidence) external;
}
