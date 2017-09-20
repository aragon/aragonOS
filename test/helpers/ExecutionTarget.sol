pragma solidity 0.4.15;

contract ExecutionTarget {
    uint public counter;

    function execute() {
        counter += 1;
        Executed(counter);
    }

    function setCounter(uint x) {
        counter = x;
    }

    event Executed(uint x);
}
