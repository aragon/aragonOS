pragma solidity ^0.4.13;


contract BylawOracle {
    function canPerformAction(
        address sender,
        bytes data,
        address token,
        uint256 value
    ) returns (bool ok, uint256 actionId);
    
}
