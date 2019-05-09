pragma solidity ^0.4.24;

import "./BaseRelayer.sol";


contract RelayerAragonAppWithVolatileSender is BaseRelayer {
    function exec(address from, uint256 nonce, bytes calldata, bytes signature) external refundGas auth(OFF_CHAIN_RELAYER_SERVICE_ROLE) {
        assertValidTransaction(from, nonce, calldata, signature);

        setVolatileStorageSender(from);
        setUsedNonce(from, nonce, true);

        bool success = address(this).call(calldata);
        if (!success) revertForwardingError();

        setVolatileStorageSender(address(0));
        emit TransactionRelayed(from, address(this), nonce, calldata);
    }

    function isNonceUsed(address _account, uint256 _nonce) public view returns (bool) {
        return usedNonce(_account, _nonce);
    }

    function sender() internal view returns (address) {
        if (msg.sender != address(this)) return msg.sender;
        address volatileSender = volatileStorageSender();
        return volatileSender != address(0) ? volatileSender : address(this);
    }
}
