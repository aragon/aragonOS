pragma solidity ^0.4.24;


library RelayHelper {
    function revertForwardingError() internal {
        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize)
            revert(ptr, returndatasize)
        }
    }
}
