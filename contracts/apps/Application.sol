pragma solidity ^0.4.11;

import "../organs/IOrgan.sol";
import "./IApplication.sol";

contract Application is IApplication {
    IOrgan.DAOMessage dao_msg;
    address public dao;

    modifier onlyDAO {
        require(dao == 0 || msg.sender == dao);
        _;
    }

    function Application(address newDAO) {
        setDAO(newDAO);
    }

    function setDAO(address newDAO) onlyDAO {
        if (newDAO == 0) return;
        dao = newDAO;
        init();
    }

    function init() internal {}

    function setDAOMsg(address sender, address token, uint value) onlyDAO {
        dao_msg.sender = sender;
        dao_msg.token = token;
        dao_msg.value = value;
    }

    function getSender() internal returns (address) {
        return msg.sender == dao ? dao_msg.sender : msg.sender;
    }
}
