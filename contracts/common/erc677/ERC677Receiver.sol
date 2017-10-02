pragma solidity 0.4.15;

contract ERC677Receiver {
<<<<<<< HEAD
    function tokenFallback(address from, uint256 amount, bytes data) returns (bool success);
=======
    function tokenFallback(address from, uint256 amount, bytes data) external returns (bool success);
>>>>>>> fundraising-polish
}
