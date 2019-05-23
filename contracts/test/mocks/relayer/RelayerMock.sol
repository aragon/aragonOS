pragma solidity 0.4.24;

import "../../../relayer/Relayer.sol";
import "../../../test/mocks/common/TimeHelpersMock.sol";


contract RelayerMock is Relayer, TimeHelpersMock {
    uint256 public chainId;

    function initializeWithChainId(uint256 _monthlyRefundQuota, uint256 _chainId) external onlyInit {
        initialized();
        startDate = getTimestamp();
        monthlyRefundQuota = _monthlyRefundQuota;
        setDepositable(true);

        chainId = _chainId;
    }

    function messageHash(address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice) public view returns (bytes32) {
        return _messageHash(to, nonce, data, gasRefund, gasPrice);
    }

    function _domainChainId() internal view returns (uint256) {
        return chainId == 0 ? 1 : chainId;
    }
}
