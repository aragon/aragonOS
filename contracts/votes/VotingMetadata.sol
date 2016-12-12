pragma solidity ^0.4.6;

contract VotingMetadata {
  string public title;
  string public description;
}

contract BinaryVotingMetadata {
  uint256 public neededSupport;
  uint256 public supportBase;
}
