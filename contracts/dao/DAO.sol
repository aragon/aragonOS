pragma solidity ^0.4.11;

import "./AbstractDAO.sol";
import "../kernel/DAOKernel.sol";

contract DAO is AbstractDAO {
  function DAO() {
    kernel = address(new DAOKernel());
    self = address(this);
  }

  function () payable {
    if (!kernel.delegatecall(msg.data)) throw;
  }
}
