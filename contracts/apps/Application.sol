pragma solidity ^0.4.11;

import "../organs/IOrgan.sol";
import "./IApplication.sol";

contract Application is IApplication {
    address public dao;

    modifier onlyDAO {
        require(msg.sender == dao);
        _;
    }

    function Application(address newDAO) {
        setDAO(newDAO);
    }

    /**
    * @dev setDAO can be called outside of constructor for allowing Forwarder contracts
    */
    function setDAO(address newDAO) {
        if (newDAO == 0) return;
        require(dao == 0); // bypassing of all bylaws can happen if changing dao reference for app
        dao = newDAO;
        init();
    }

    function init() internal {}

    function getSender() internal returns (address) {
        return msg.sender == dao ? dao_msg().sender : msg.sender;
    }
}
