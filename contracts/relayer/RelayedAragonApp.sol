pragma solidity ^0.4.24;


import "../apps/AragonApp.sol";


interface IRelayedAragonApp {
    function exec(address from, bytes calldata) external;
}

contract RelayedAragonApp is IRelayedAragonApp, AragonApp {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    function exec(address from, bytes calldata) external auth(RELAYER_ROLE) {
        setVolatileStorageSender(from);
        bool success = address(this).call(calldata);
        if (!success) revertForwardingError();
        setVolatileStorageSender(address(0));
    }

    function sender() internal view returns (address) {
        if (msg.sender != address(this)) return msg.sender;
        address volatileSender = volatileStorageSender();
        return volatileSender != address(0) ? volatileSender : address(this);
    }

    function revertForwardingError() private {
        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize)
            revert(ptr, returndatasize)
        }
    }
}
