pragma solidity ^0.4.24;


contract IRelayer {
    function relay(address from, address to, uint256 nonce, bytes data, uint256 gasRefund, uint256 gasPrice, bytes signature) external;
}
