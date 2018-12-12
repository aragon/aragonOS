pragma solidity 0.4.24;


contract ExecutionTarget {
    uint public counter;

    function execute() public {
        counter += 1;
        emit Executed(counter);
    }

    function failExecute() public pure {
        revert();
    }

    function setCounter(uint x) public {
        counter = x;
    }

    event Executed(uint x);
}
