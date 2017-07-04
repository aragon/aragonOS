pragma solidity ^0.4.11;

contract Vote {
  address public dao;
  bytes public data;

  function instantiate(address _dao, bytes _data) {
    require(dao == 0);
    dao = _dao;
    data = _data;
  }

  function execute() {
    assert(dao.call(data));
    selfdestruct(dao);
  }
}
