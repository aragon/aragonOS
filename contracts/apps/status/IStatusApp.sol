pragma solidity ^0.4.13;

contract IStatusOracle {
    function getEntityStatus(address entity) constant public returns (uint);
}

contract IStatusApp is IStatusOracle {
    function setEntityStatus(address entity, uint8 status) external;
}