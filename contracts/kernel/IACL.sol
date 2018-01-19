pragma solidity ^0.4.18;


interface IACL {
    function initialize(address _permissionsCreator) public;
    function hasPermission(address who, address where, bytes32 what, bytes how) view public returns (bool);
}
