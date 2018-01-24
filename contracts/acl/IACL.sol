pragma solidity ^0.4.18;


interface IACL {
    function initialize(address permissionsCreator) public;
    function hasPermission(address who, address where, bytes32 what, bytes how) public view returns (bool);
}
