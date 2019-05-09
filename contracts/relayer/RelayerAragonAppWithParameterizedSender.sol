pragma solidity ^0.4.24;

import "./BaseRelayer.sol";


contract RelayerAragonAppWithParameterizedSender is BaseRelayer {
    modifier relayedAuth(address _sender, bytes32 _role) {
        require(canPerform(_sender, _role, new uint256[](0)), ERROR_AUTH_FAILED);
        _;
    }

    modifier relayedAuthP(address _sender, bytes32 _role, uint256[] _params) {
        require(canPerform(_sender, _role, _params), ERROR_AUTH_FAILED);
        _;
    }

    function exec(address from, uint256 nonce, bytes calldata, bytes signature) external refundGas auth(OFF_CHAIN_RELAYER_SERVICE_ROLE) {
        assertValidTransaction(from, nonce, calldata, signature);

        setLastNonce(from, nonce);
        bool success = address(this).call(calldata);
        if (!success) revertForwardingError();
        emit TransactionRelayed(from, address(this), nonce, calldata);
    }

    function isNonceUsed(address _account, uint256 _nonce) public view returns (bool) {
        return lastNonce(_account) >= _nonce;
    }
}
