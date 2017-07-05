pragma solidity ^0.4.11;

contract Vote {
  address public dao;
  bytes public data;

  function instantiate(address _dao, bytes _data) {
    require(dao == 0 && data.length == 0); // dont allow to reinstantiate a vote
    require(_dao != 0);
    dao = _dao;
    data = _data;
  }

  // For Vote to be completely safe to be forwarded to the master instance of the contract
  // has to be instantiated with _dao = this so dao.call() would fail and the selfdestruct
  // can never happen in the master contract
  function execute() {
    assert(dao.call(data));
    selfdestruct(dao);
  }
}
