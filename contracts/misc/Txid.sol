pragma solidity ^0.4.11;

contract Txid {
  string public txid;
  function setTxid(string _txid) {
    if (bytes(txid).length > 0) throw; // only can be set once

    txid = _txid;
  }
}
