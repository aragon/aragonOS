pragma solidity ^0.4.8;

import "./AbstractApplication.sol";

contract Application is AbstractApplication {
  DAOMessage dao_msg;
  address dao;

  modifier onlyDao {
    if (dao != 0 && msg.sender != dao) throw;
    _;
  }

  function Application(address newDao) {
    setDao(newDao);
  }

  function setDao(address newDao) onlyDao {
    dao = newDao;
  }

  function setDAOMsg(address sender, address token, uint value) {
    dao_msg.sender = sender;
    dao_msg.dao = msg.sender;
    dao_msg.token = token;
    dao_msg.value = value;
  }
}
