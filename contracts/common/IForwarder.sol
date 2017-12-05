pragma solidity 0.4.15;

contract IForwarder {
    function isForwarder() public constant returns (bool) { return true; }

    function canForward(address _sender, bytes _evmCallScript) public constant returns (bool);
    function forward(bytes _evmCallScript) public;
}
