/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "./IAgreement.sol";
import "../../lib/token/ERC20.sol";
import "../../lib/standards/ERC165.sol";


contract IDisputable is ERC165 {
    bytes4 internal constant ERC165_INTERFACE_ID = bytes4(0x01ffc9a7);
    bytes4 internal constant DISPUTABLE_INTERFACE_ID = bytes4(0xef113021);

    function setAgreement(IAgreement _agreement) external;

    function onDisputableActionChallenged(uint256 _disputableActionId, uint256 _challengeId, address _challenger) external;

    function onDisputableActionAllowed(uint256 _disputableActionId) external;

    function onDisputableActionRejected(uint256 _disputableActionId) external;

    function onDisputableActionVoided(uint256 _disputableActionId) external;

    function getAgreement() external view returns (IAgreement);

    /**
    * @dev Query if a contract implements a certain interface
    * @param _interfaceId The interface identifier being queried, as specified in ERC-165
    * @return True if the contract implements the requested interface and if its not 0xffffffff, false otherwise
    */
    function supportsInterface(bytes4 _interfaceId) external pure returns (bool) {
        return _interfaceId == DISPUTABLE_INTERFACE_ID || _interfaceId == ERC165_INTERFACE_ID;
    }
}
