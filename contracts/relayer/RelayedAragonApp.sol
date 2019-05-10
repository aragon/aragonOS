pragma solidity ^0.4.24;

import "./IRelayer.sol";
import "../apps/AragonApp.sol";


contract RelayedAragonApp is AragonApp {

    function sender() internal view returns (address) {
        address relayer = address(_relayer());
        if (msg.sender != relayer) return msg.sender;

        address signer = _decodeSigner();
        return signer != address(0) ? signer : relayer;
    }

    function _decodeSigner() internal returns (address signer) {
        bytes memory calldata = msg.data;
        assembly { signer := mload(add(calldata, calldatasize)) }
    }

    function _relayer() internal returns (IRelayer) {
        return kernel().relayer();
    }
}
