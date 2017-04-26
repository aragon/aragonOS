pragma solidity ^0.4.8;

contract AbstractApplication {
  function canHandlePayload(bytes payload) constant returns (bool);
  function setDAOMsg(address sender, address token, uint value);
}
