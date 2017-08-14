pragma solidity ^0.4.13;

contract IApplication {
    function init() internal;
    function setDAOMsg(address sender, address token, uint value);
}
