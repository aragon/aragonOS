pragma solidity 0.4.24;


contract ExecutionTarget {
    string public constant ERROR_EXECUTION_TARGET = "EXECUTION_TARGET_REVERTED";
    uint public counter;

    function execute() public {
        counter += 1;
        emit Executed(counter);
    }

    function failExecute(bool errorWithData) public pure {
        if (errorWithData) {
            revert(ERROR_EXECUTION_TARGET);
        } else {
            revert();
        }
    }

    function setCounter(uint x) public {
        counter = x;
    }

    event Executed(uint x);
}
