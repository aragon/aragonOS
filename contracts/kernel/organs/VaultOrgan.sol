pragma solidity ^0.4.11;

import "./Organ.sol";
import "../../tokens/EtherToken.sol";
import "./MetaOrgan.sol";
import "zeppelin/SafeMath.sol";

contract IVaultOrgan {
  function deposit(address _token, uint256 _amount);
  function getTokenBalance(address _token) constant returns (uint256);

  function transfer(address _token, address _to, uint256 _amount);
  function transferEther(address _to, uint256 _amount);

  function halt();
  function setHaltTime(uint256 _haltTime);
  function getHaltTime() constant returns (uint256);

  function scapeHatch(address[] _tokens);
  function setScapeHatch(address _scapeHatch);
  function getScapeHatch() constant returns (address);

  function setTokenBlacklist(address _token, bool _blacklisted);
  function isTokenBlacklisted(address _token) constant returns (bool);
}

contract VaultOrgan is Organ, SafeMath {
  uint8 constant kernelPrimaryKey = 0x01; // probably can move ether token completely here
  uint8 constant vaultPrimaryKey = 0x05;

  uint8 constant balanceSecondaryKey = 0x00;

  event Deposit(address indexed token, uint256 amount);
  event NewTokenDeposit(address token);

  // deposit is not reachable on purpose using normal dispatch route
  function deposit(address _token, uint256 _amount) payable {
    if (_amount == 0) return;
    if (_token == getEtherToken()) depositEther(_amount);

    uint256 currentBalance = getTokenBalance(_token);
    // This will actually be dispatched every time balance goes from 0 to non-zero.
    // The idea is that the frontend can listen for this event in all DAO history.
    if (currentBalance == 0) NewTokenDeposit(_token);

    // Aragon Network funds redirect goes here :)
    uint256 newBalance = safeAdd(currentBalance, _amount); // - aragonNetworkFee;
    // Check token balance isn't less than expected.
    // Could be less because of a faulty erc20 implementation (can't trust)
    // Could be more because a token transfer can be done without notifying
    assert(newBalance >= ERC20(_token).balanceOf(this));
    setTokenBalance(_token, newBalance);

    Deposit(_token, _amount);
  }

  function depositEther(uint256 _amount) internal {
    assert(address(this).balance >= _amount);
    EtherToken(getEtherToken()).wrap.value(_amount)();
  }

  function storageKeyForBalance(address _token) constant returns (bytes32) {
    return sha3(vaultPrimaryKey, balanceSecondaryKey, _token);
  }

  function setTokenBalance(address _token, uint256 _balance) {
    storageSet(storageKeyForBalance(_token), _balance);
  }

  function getTokenBalance(address _token) constant returns (uint256) {
    return storageGet(storageKeyForBalance(_token));
  }

  function organWasInstalled() {
    // TODO: Replace for constant for EtherToken
    MetaOrgan(this).setEtherToken(address(new EtherToken()));
    setReturnSize(0x3aecd0e3, 32);
  }

  function canHandlePayload(bytes _payload) returns (bool) {
    // TODO: Really return true on handleable functions
    bytes4 sig = getFunctionSignature(_payload);
    return
      sig == 0x3aecd0e3
    ;
  }

  function getEtherToken() constant returns (address) {
    return address(storageGet(sha3(0x01, 0x02)));
  }
}
