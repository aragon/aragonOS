pragma solidity ^0.4.11;

import "../organs/IOrgan.sol";
import "./IApplication.sol";
import "zeppelin/token/ERC20.sol";
import "../kernel/Kernel.sol";

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

    function setDAOMsg(address sender, address token, uint value) onlyDAO {
        dao_msg.sender = sender;
        dao_msg.token = token;
        dao_msg.value = value;
    }

    function getSender() internal returns (address) {
        return msg.sender == dao ? dao_msg.sender : msg.sender;
    }
}
