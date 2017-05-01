pragma solidity ^0.4.8;

import "./AbstractApplication.sol";

contract Application is AbstractApplication {
  DAOMessage dao_msg;
  address dao;

  modifier onlyDAO {
    if (dao != 0 && msg.sender != dao) throw;
    _;
  }

  function Application(address newDAO) {
    setDAO(newDAO);
  }

  function setDAO(address newDAO) onlyDAO {
    dao = newDAO;
  }

  function setDAOMsg(address sender, address token, uint value) {
    dao_msg.sender = sender;
    dao_msg.dao = msg.sender;
    dao_msg.token = token;
    dao_msg.value = value;
  }
}
