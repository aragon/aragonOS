pragma solidity ^0.4.6;

import "zeppelin-solidity/contracts/token/ERC20Basic.sol";

contract Shareholders is ERC20Basic {
  mapping (uint256 => address) public shareholders;
  uint256 public shareholderIndex;
  mapping (address => bool) private isShareholder;

  function transfer(address _to, uint _value) {
    super.transfer(_to, _value);
    if (!isShareholder[_to]) addShareholder(_to);
  }

  function addShareholder(address holder) private {
    isShareholder[holder] = true;
    shareholders[shareholderIndex] = holder;
    shareholderIndex += 1;
  }
}
