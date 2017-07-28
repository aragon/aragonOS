pragma solidity ^0.4.13;

import "./IOrgan.sol";

// @dev ActionsOrgan allows to make external calls on behalf of the DAO
contract ActionsOrgan is IOrgan {
    /**
    * @dev Extremely critical, all DAO assets can be lost if set inappropriately.
    * @notice Perform arbitrary actions on behalf of the DAO.
    * @param _to address being called
    * @param _data data being executed in `_to`
    */
    function performAction(address _to, bytes _data) returns (bool) {
        return _to.call(_data); // performs action with DAO as msg.sender
    }
}
