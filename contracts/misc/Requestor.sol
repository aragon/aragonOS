pragma solidity ^0.4.13;


// Simulates web3 ability to do token.transfer.request() that returns the data needed
// to perform that call
// Problem: requires to store
contract Requestor {
    bytes data;

    function getData() internal returns (bytes) {
        bytes memory d = data;
        data = new bytes(0); // remove storage on get so it refunds some gas
        return d;
    }

    function () {
        data = msg.data;
    }
}
