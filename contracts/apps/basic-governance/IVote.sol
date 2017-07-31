pragma solidity ^0.4.13;

contract IVote {
    function wasExecuted() constant public returns (bool);
    function execute();
}
