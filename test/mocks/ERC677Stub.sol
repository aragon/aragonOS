pragma solidity 0.4.18;

import "../../contracts/lib/erc677/ERC677Receiver.sol";

contract ERC677Stub is ERC677Receiver {
    address public token;
    address public from;
    uint256 public amount;
    bytes public data;

    function tokenFallback(address _from, uint256 _amount, bytes _data) external returns (bool success) {
        token = msg.sender;
        from = _from;
        amount = _amount;
        data = _data;

        return true;
    }
}
