pragma solidity ^0.4.11;

import "../organs/IOrgan.sol";
import "./IApplication.sol";

contract Application is IApplication {
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

    function getSender() internal returns (address) {
        return msg.sender == dao ? dao_msg().sender : msg.sender;
    }
}
