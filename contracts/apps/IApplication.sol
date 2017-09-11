pragma solidity ^0.4.13;

import "../misc/DAOMsg.sol";

contract IApplication is DAOMsgReader {
    function init() internal;
    function appId() constant returns (string);
    function version() constant returns (string);
}
