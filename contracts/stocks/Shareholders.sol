pragma solidity ^0.4.8;

import "zeppelin/token/ERC20.sol";

contract Shareholders is ERC20 {
  mapping (uint256 => address) public shareholders;
  uint256 public shareholderIndex;

  function transfer(address _to, uint _value) returns (bool success) {
    addShareholder(_to);
    return super.transfer(_to, _value);
  }

  function isShareholder(address holder) returns (bool) {
    return balanceOf(holder) > 0;
  }

  function addShareholder(address holder) internal {
    if (isShareholder(holder)) return;

    shareholders[shareholderIndex] = holder;
    shareholderIndex += 1;
  }
}
