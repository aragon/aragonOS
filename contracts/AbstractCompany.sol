pragma solidity ^0.4.6;

contract AbstractCompany {
  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
}
