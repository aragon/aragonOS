pragma solidity ^0.4.18;


interface ERCProxy {
    function proxyType() public pure returns (uint256 proxyTypeId);
    function implementation() public view returns (address codeAddr);
}
