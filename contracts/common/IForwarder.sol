pragma solidity 0.4.15;

contract IForwarder {
    function isForwarder() constant returns (bool) { return true; }

    function canForward(address _sender, bytes _evmCallScript) constant returns (bool);
    function forward(bytes _evmCallScript) external;
}
