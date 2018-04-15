pragma solidity 0.4.18;


contract ExecutionTarget {
    uint public counter;

    function execute() public {
        counter += 1;
        Executed(counter);
    }

    function failExecute() public constant {
        revert();
    }

    function setCounter(uint x) public {
        counter = x;
    }

    event Executed(uint x);
}
