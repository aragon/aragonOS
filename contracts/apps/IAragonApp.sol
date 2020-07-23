/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../kernel/IKernel.sol";
import "../lib/standards/ERC165.sol";


contract IAragonApp is ERC165 {
    bytes4 internal constant ARAGON_APP_INTERFACE_ID = bytes4(0x54053e6c);

    function kernel() public view returns (IKernel);
    function appId() public view returns (bytes32);

    /**
    * @dev Query if a contract implements a certain interface
    * @param _interfaceId The interface identifier being queried, as specified in ERC-165
    * @return True if the contract implements the requested interface and if its not 0xffffffff, false otherwise
    */
    function supportsInterface(bytes4 _interfaceId) public pure returns (bool) {
        return super.supportsInterface(_interfaceId) || _interfaceId == ARAGON_APP_INTERFACE_ID;
    }
}
