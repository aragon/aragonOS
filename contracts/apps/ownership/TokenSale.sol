pragma solidity ^0.4.11;

import "zeppelin/token/ERC20.sol";
import "../../kernel/organs/VaultOrgan.sol";
import "../../kernel/Kernel.sol";
import "../../tokens/EtherToken.sol";

import "./OwnershipApp.sol";

contract TokenSale {
  address public dao;
  OwnershipApp public ownershipApp;
  ERC20 public raiseToken;

  function buy(uint256 amount) internal;

  function () payable {
    EtherToken etherToken = getEtherToken();
    require(raiseToken == etherToken);

    etherToken.wrap.value(msg.value)();
    buy(msg.value);
  }

  function mintToken

  // @dev make a send that is compatible with any kind of erc20
  function sendFunds() internal {
    raiseToken.approve(dao, 0);  // jic to avoid contracts that throw for not being 0 before allowance

    uint balance = raiseToken.balanceOf(address(this));
    raiseToken.approve(dao, balance);
    Kernel(dao).receiveApproval(address(this), balance, address(raiseToken), new bytes(0));
  }

  function tokenFallback(address _sender, address _origin, uint256 _value, bytes _data) onlyToken returns (bool ok) {
    buy(_value);
    return true;
  }

  // ApproveAndCall compatible
  function receiveApproval(address _sender, uint256 _value, address _token, bytes _data) onlyToken {
    assert(ERC20(_token).transferFrom(_sender, address(this), _value));
    buy(_value);
  }

  function getEtherToken() constant returns (EtherToken) {
    return EtherToken(VaultOrgan(dao).getEtherToken());
  }

  modifier onlyToken {
    require(msg.sender != address(raiseToken));
    _;
  }
}
