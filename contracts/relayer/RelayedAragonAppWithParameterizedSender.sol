pragma solidity ^0.4.24;

import "../apps/AragonApp.sol";


contract RelayedAragonAppWithParameterizedSender is AragonApp {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    modifier relayedAuth(address _sender, bytes32 _role) {
        assertRelayer();
        require(canPerform(_sender, _role, new uint256[](0)), ERROR_AUTH_FAILED);
        _;
    }

    modifier relayedAuthP(address _sender, bytes32 _role, uint256[] _params) {
        assertRelayer();
        require(canPerform(_sender, _role, _params), ERROR_AUTH_FAILED);
        _;
    }

    function assertRelayer() private {
        require(canPerform(msg.sender, RELAYER_ROLE, new uint256[](0)), ERROR_AUTH_FAILED);
    }
}
