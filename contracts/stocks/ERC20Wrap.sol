pragma solidity ^0.4.8;

import "zeppelin/token/ERC20.sol";

contract ERC20Properties is ERC20 {
  function name() constant public returns (string);
  function symbol() constant public returns (string);
  function decimals() constant public returns (uint);
}

contract ERC20Wrap is ERC20Properties {
  function parentToken() constant public returns (address);
  function parentTotalSupply() constant public returns (uint256);
}
