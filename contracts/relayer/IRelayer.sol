pragma solidity ^0.4.24;


contract IRelayer {
    function relay(address from, address to, uint256 nonce, bytes calldata, bytes signature) external;
}
