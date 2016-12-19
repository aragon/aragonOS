pragma solidity ^0.4.6;

contract AbstractCompany {
  mapping (uint8 => address) public stocks;
  uint8 public stockIndex;

  mapping (uint256 => address) public votings;
  mapping (address => uint256) public reverseVotings;
  mapping (uint256 => uint8) public voteExecuted;
  uint256 public votingIndex;

  mapping (uint256 => address) public sales;
  mapping (address => uint256) public reverseSales;
  uint256 public saleIndex;


  function setVotingExecuted(uint8 option);
  function countVotes(uint256 votingId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes);
  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
  function grantVestedStock(uint8 _stock, uint256 _amount, address _recipient, uint64 _cliff, uint64 _vesting) public;

  function beginSale(address saleAddress);
  function assignStock(uint8 stockId, address holder, uint256 units);
  function removeStock(uint8 stockId, address holder, uint256 units);
}
