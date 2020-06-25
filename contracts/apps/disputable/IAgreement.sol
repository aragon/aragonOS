/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../../acl/IACLOracle.sol";
import "../../lib/token/ERC20.sol";
import "../../lib/arbitration/IArbitrable.sol";


contract IAgreement is IArbitrable, IACLOracle {

    event Signed(address indexed signer, uint256 settingId);
    event SettingChanged(uint256 settingId);
    event DisputableAppActivated(address indexed disputable);
    event DisputableAppDeactivated(address indexed disputable);
    event CollateralRequirementChanged(address indexed disputable, uint256 collateralRequirementId);
    event ActionSubmitted(uint256 indexed actionId);
    event ActionClosed(uint256 indexed actionId);
    event ActionChallenged(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionSettled(uint256 indexed actionId, uint256 indexed challengeId);
    event ActionDisputed(uint256 indexed actionId, uint256 indexed challengeId, uint256 indexed disputeId);
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

    function sign() external;

    function activate(
        address _disputable,
        ERC20 _collateralToken,
        uint64 _challengeDuration,
        uint256 _actionAmount,
        uint256 _challengeAmount
    )
        external;

    function deactivate(address _disputable) external;

    function newAction(uint256 _disputableActionId, bytes _context, address _submitter) external returns (uint256);

    function closeAction(uint256 _actionId) external;

    function challengeAction(uint256 _actionId, uint256 _settlementOffer, bool _finishedSubmittingEvidence, bytes _context) external;

    function settle(uint256 _actionId) external;

    function disputeAction(uint256 _actionId, bool _finishedSubmittingEvidence) external;

    function getSigner(address _signer) external view returns (uint256 lastSettingIdSigned, bool mustSign);

    function getCurrentSettingId() external view returns (uint256);

    function getSetting(uint256 _settingId) external view returns (IArbitrator arbitrator, string title, bytes content);

    function getDisputableInfo(address _disputable) external view returns (bool registered, uint256 currentCollateralRequirementId);

    function getCollateralRequirement(address _disputable, uint256 _collateralId) external view
        returns (
            ERC20 collateralToken,
            uint256 actionAmount,
            uint256 challengeAmount,
            uint64 challengeDuration
        );

    function getAction(uint256 _actionId) external view
        returns (
            address disputable,
            uint256 disputableActionId,
            uint256 collateralRequirementId,
            uint256 settingId,
            address submitter,
            bool closed,
            bytes context,
            uint256 currentChallengeId
        );

    function getChallenge(uint256 _challengeId) external view
        returns (
            uint256 actionId,
            address challenger,
            uint64 endDate,
            bytes context,
            uint256 settlementOffer,
            uint256 arbitratorFeeAmount,
            ERC20 arbitratorFeeToken,
            ChallengeState state,
            bool submitterFinishedEvidence,
            bool challengerFinishedEvidence,
            uint256 disputeId,
            uint256 ruling
        );
}
