pragma solidity 0.4.18;

interface IProxy {
    function isUpgradeable() public pure returns (bool);
    function getCode() public view returns (address);
}
