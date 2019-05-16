pragma solidity 0.4.24;

import "../../../relayer/Relayer.sol";
import "../../../test/mocks/common/TimeHelpersMock.sol";


contract RelayerMock is Relayer, TimeHelpersMock {
    function messageHash(address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice) public view returns (bytes32) {
        return _messageHash(to, nonce, data, gasRefund, gasPrice);
    }

    function domainSeparator() public view returns (bytes32) {
        return _domainSeparator();
    }
}
