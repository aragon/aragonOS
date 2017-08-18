pragma solidity ^0.4.11;

import "../organs/IOrgan.sol";
import "./IApplication.sol";
import "zeppelin/token/ERC20.sol";
import "../kernel/Kernel.sol";

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

    /**
    * @notice Send stuck tokens of `_token` in app contract to DAO
    * @dev Tokens could end up stuck in app contracts by mistake. Sends them to DAO.
    * @param _token The address of the token whose balance is being unstucked (If 0, it is ether balance)
    */
    function unstuckToken(address _token) public {
        require(dao != 0);
        if (_token == 0x0) {
            require(dao.call.value(this.balance)());
            return;
        }

        ERC20 token = ERC20(_token);
        uint256 balance = token.balanceOf(this);
        token.approve(dao, balance);
        Kernel(dao).receiveApproval(this, balance, _token, new bytes(0));
    }

    function init() internal {}

    function getSender() internal returns (address) {
        return msg.sender == dao ? dao_msg().sender : msg.sender;
    }
}
