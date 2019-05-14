pragma solidity ^0.4.24;

import "./IRelayer.sol";
import "../apps/AragonApp.sol";


contract RelayedAragonApp is AragonApp {

    function sender() internal view returns (address) {
        address relayer = address(_relayer());
        if (msg.sender != relayer) {
            return msg.sender;
        }

        address signer = _decodeSigner();
        return signer != address(0) ? signer : relayer;
    }

    function _decodeSigner() internal returns (address signer) {
        // Note that calldatasize includes one word more than the original calldata array, due to the address of the
        // signer that is being appended at the end of it. Thus, we are loading the last word of the calldata array to
        // fetch the actual signed of the relayed call
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 0x20))
            calldatacopy(ptr, sub(calldatasize, 0x20), 0x20)
            signer := mload(ptr)
        }
    }

    function _relayer() internal returns (IRelayer) {
        return kernel().relayer();
    }
}
