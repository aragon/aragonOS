/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./IDisputable.sol";
import "./IArbitrable.sol";
import "../../acl/IACLOracle.sol";
import "../../lib/token/ERC20.sol";


contract IAgreement is IArbitrable, IACLOracle {
    function sign() external;

    function newAction(uint256 _disputableActionId, uint64 _lifetime, address _submitter, bytes _context) external returns (uint256);

    function closeAction(uint256 _actionId) external;

    function challengeAction(uint256 _actionId, uint256 _settlementOffer, bool _finishedSubmittingEvidence, bytes _context) external;

    function settle(uint256 _actionId) external;

    function disputeAction(uint256 _actionId, bool _finishedSubmittingEvidence) external;

    function register(
        IDisputable _disputable,
        ERC20 _collateralToken,
        uint256 _actionAmount,
        uint256 _challengeAmount,
        uint64 _challengeDuration
    )
        external;

    function unregister(IDisputable _disputable) external;

    function canProceed(uint256 _actionId) external view returns (bool);
}
