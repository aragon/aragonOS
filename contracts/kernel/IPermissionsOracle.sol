pragma solidity ^0.4.11;

contract IPermissionsOracle {
    function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool);
}
