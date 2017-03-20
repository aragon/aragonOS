pragma solidity ^0.4.8;

import "zeppelin/token/ERC20Basic.sol";

contract Shareholders is ERC20Basic {
  mapping (uint256 => address) public shareholders;
  uint256 public shareholderIndex;

  function transfer(address _to, uint _value) {
    addShareholder(_to);
    super.transfer(_to, _value);
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
