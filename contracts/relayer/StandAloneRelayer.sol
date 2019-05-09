pragma solidity ^0.4.24;

import "./BaseRelayer.sol";


contract StandAloneRelayer is BaseRelayer {
    mapping (address => uint256) internal lastUsedNonce;

    function relay(address from, address to, uint256 nonce, bytes calldata, bytes signature) external refundGas auth(OFF_CHAIN_RELAYER_SERVICE_ROLE) {
        assertValidTransaction(from, nonce, calldata, signature);

        lastUsedNonce[from] = nonce;
        bool success = to.call(calldata);
        if (!success) revertForwardingError();
        emit TransactionRelayed(from, to, nonce, calldata);
    }

    function isNonceUsed(address sender, uint256 nonce) public view returns (bool) {
        return lastUsedNonce[sender] >= nonce;
    }
}
