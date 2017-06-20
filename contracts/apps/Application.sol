pragma solidity ^0.4.11;

import "../dao/DAOStorage.sol";
import "./IApplication.sol";

contract Application is IApplication {
  DAOStorage.DAOMessage dao_msg;
  address public dao;

  modifier onlyDAO {
    require(dao == 0 || msg.sender == dao);
    _;
  }

  function Application(address newDAO) {
    setDAO(newDAO);
  }

  function setDAO(address newDAO) onlyDAO {
    dao = newDAO;
  }

  function setDAOMsg(address sender, address token, uint value) onlyDAO {
    dao_msg.sender = sender;
    dao_msg.token = token;
    dao_msg.value = value;
  }

  function getSig(bytes d) returns (bytes4 sig) {
    assembly { sig := mload(add(d, 0x20)) }
  }
}
