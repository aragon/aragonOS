pragma solidity ^0.4.13;

import "../../contracts/apps/Application.sol";
import "../../contracts/organs/IOrgan.sol";

contract DAOMsgOrgan is IOrgan {
    function assertDaoMsg(address sender, address token, uint256 value) payable {
        require(dao_msg().sender == sender);
        require(dao_msg().token == token);
        require(dao_msg().value == value);
        require(dao_msg().data.length == 4 + 32 * 3);
    }
}

contract DAOMsgApp is Application {
    function DAOMsgApp() Application(0) {}

    function appId() constant returns (string) {
        return "mock.aragonpm.eth";
    }

    function version() constant returns (string) {
        return "1.0.0";
    }

    function assertDaoMsg(address sender, address token, uint256 value) payable {
        require(dao_msg().sender == sender);
        require(dao_msg().token == token);
        require(dao_msg().value == value);
        require(dao_msg().data.length == 4 + 32 * 3);
    }
}
