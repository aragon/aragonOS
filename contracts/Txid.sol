pragma solidity ^0.4.6;

contract Txid {
  string public txid;
  function setTxid(string _txid) {
    if (bytes(txid).length > 0) throw; // only can be set once

    txid = _txid;
  }
}

contract BinaryVotingMetadata {
  uint256 public neededSupport;
  uint256 public supportBase;
}
