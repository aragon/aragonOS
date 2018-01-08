pragma solidity ^0.4.18;

contract IForwarder {
    function isForwarder() public pure returns (bool) { return true; }

    function canForward(address _sender, bytes _evmCallScript) public view returns (bool);
    function forward(bytes _evmCallScript) public;
}
