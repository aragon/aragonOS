pragma solidity ^0.4.6;

contract AbstractCompany {
  function votings(uint256 id) public returns (address);
  function reverseVotings(address ad) public returns (uint256);

  function setVotingExecuted(uint8 option);
  function countVotes(uint256 votingId, uint8 optionId) returns (uint256 votes, uint256 totalPossibleVotes);
  function addStock(address newStock, uint256 issue) public;
  function issueStock(uint8 _stock, uint256 _amount) public;
  function grantStock(uint8 _stock, uint256 _amount, address _recipient) public;
}
