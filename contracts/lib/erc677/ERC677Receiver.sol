pragma solidity ^0.4.18;


contract ERC677Receiver {
    function tokenFallback(address from, uint256 amount, bytes data) external returns (bool success);
}
