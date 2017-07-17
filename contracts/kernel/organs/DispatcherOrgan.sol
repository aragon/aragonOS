pragma solidity ^0.4.11;

import "./IOrgan.sol";
import "../../dao/DAOStorage.sol";

// @dev This organ is responsible for finding what is the first organ that can perform an action
// and dispatching it.
contract DispatcherOrgan is IOrgan {
    function organWasInstalled() {}

    function canHandlePayload(bytes payload) returns (bool) {
        return getResponsiveOrgan(payload) != 0;
    }

    function () payable public {
        address responsiveOrgan = getResponsiveOrgan(msg.data);
        assert(responsiveOrgan > 0); // assert that there is an organ capable of performing the action
        address target = responsiveOrgan;
        uint32 len = getReturnSize();

        assembly {
            calldatacopy(0x0, 0x0, calldatasize)
            let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
            jumpi(invalidJumpLabel, iszero(result))
            return(0, len)
        }
    }

    function getResponsiveOrgan(bytes payload) returns (address) {
        uint i = 2; // First checked organ is 2, doesn't check itself.
        while (true) {
            address organAddress = getOrgan(i);
            if (organAddress == 0) return 0;  // if a 0 address is returned it means, there is no more organs.
            if (IOrgan(organAddress).canHandlePayload(payload)) return organAddress; // If the organ can handle it, return.
            i++;
        }
    }
}
