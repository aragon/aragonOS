pragma solidity ^0.4.18;

interface IAppProxy {
    function isUpgradeable() public pure returns (bool);
    function getCode() public view returns (address);
}
