/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "./IAgreement.sol";
import "../../lib/standards/ERC165.sol";
import "../../lib/token/ERC20.sol";


contract IDisputable is ERC165 {
    // Includes setAgreement, onDisputableActionChallenged, onDisputableActionAllowed,
    // onDisputableActionRejected, onDisputableActionVoided, getAgreement, canChallenge, and canClose methods:
    bytes4 internal constant DISPUTABLE_INTERFACE_ID = bytes4(0xf3d3bb51);

    event AgreementSet(IAgreement indexed agreement);

    function setAgreement(IAgreement _agreement) external;

    function onDisputableActionChallenged(uint256 _disputableActionId, uint256 _challengeId, address _challenger) external;

    function onDisputableActionAllowed(uint256 _disputableActionId) external;

    function onDisputableActionRejected(uint256 _disputableActionId) external;

    function onDisputableActionVoided(uint256 _disputableActionId) external;

    function getAgreement() external view returns (IAgreement);

    function canChallenge(uint256 _disputableActionId) external view returns (bool);

    function canClose(uint256 _disputableActionId) external view returns (bool);
}
