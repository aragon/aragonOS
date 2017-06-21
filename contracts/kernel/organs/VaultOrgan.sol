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

  function halt(uint256 _haltTime);
  function getHaltTime() constant returns (uint256 started, uint256 ends);

  function scapeHatch(address[] _tokens);
  function setScapeHatch(address _scapeHatch);
  function getScapeHatch() constant returns (address);

  function setTokenBlacklist(address _token, bool _blacklisted);
  function isTokenBlacklisted(address _token) constant returns (bool);

  // recovery for tokens that were sent by error that are not accounted for
  function recoverTokens(address _token, address _to);

  event Deposit(address indexed token, address indexed sender, uint256 amount);
  event Withdraw(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
  event NewTokenDeposit(address token);
}

contract VaultOrgan is Organ, SafeMath {
  uint8 constant kernelPrimaryKey = 0x01; // probably can move ether token completely here
  uint8 constant vaultPrimaryKey = 0x05;

  uint8 constant balanceSecondaryKey = 0x00;

  bytes32 constant haltTimeKey = sha3(vaultPrimaryKey, 0x01);
  bytes32 constant haltDurationKey = sha3(vaultPrimaryKey, 0x02);
  bytes32 constant scapeHatchSecondaryKey = sha3(vaultPrimaryKey, 0x03);

  uint constant maxTokenTransferGas = 150000;
  uint constant maxHalt = 7 days; // can be prorrogated during halt

  bytes4 constant getTokenBalanceSig = 0x3aecd0e3; // getTokenBalance(address)
  bytes4 constant transferSig = 0xbeabacc8;        // transfer(address,address,uint256)
  bytes4 constant transferEtherSig = 0x05b1137b;   // transferEther(address,uint256)
  bytes4 constant haltSig = 0xfb1fad50;            // halt(uint256)
  bytes4 constant getHaltTimeSig = 0xae2ae305;     // getHaltTime()
  bytes4 constant scapeHatchSig = 0x863ca8f0;      // scapeHatch(address[])
  bytes4 constant setScapeHatchSig = 0xc4e65c99;   // setScapeHatch(address)
  bytes4 constant getScapeHatchSig = 0x4371677c;   // getScapeHatch()

  event Deposit(address indexed token, address indexed sender, uint256 amount);
  event Withdraw(address indexed token, address indexed approvedBy, uint256 amount, address recipient);
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

    Deposit(_token, dao_msg().sender, _amount);
  }

  function depositEther(uint256 _amount) internal {
    assert(address(this).balance >= _amount);
    EtherToken(getEtherToken()).wrap.value(_amount)();
  }

  // TODO: Add is halted check
  function transfer(address _token, address _to, uint256 _amount)
           only_not_halted {
    doTransfer(_token, _to, _amount);
  }

  function doTransfer(address _token, address _to, uint256 _amount) internal {
    uint newBalance = performTokenTransferAccounting(_token, _amount, _to);
    secureTokenTransfer(_token, _to, _amount); // perform actual transfer

    assert(ERC20(_token).balanceOf(this) == newBalance);
  }

  // TODO: Add is halted check
  function transferEther(address _to, uint256 _amount)
           only_not_halted {
    address etherToken = getEtherToken();
    uint newBalance = performTokenTransferAccounting(etherToken, _amount, _to);

    EtherToken(etherToken).secureWithdraw(_amount, _to);

    assert(ERC20(etherToken).balanceOf(this) == newBalance);
  }

  function halt(uint256 _haltTime) {
    assert(_haltTime <= maxHalt);

    storageSet(haltTimeKey, now);
    storageSet(haltDurationKey, _haltTime);
  }

  function scapeHatch(address[] _tokens)
           only_halted {
    address scapeHatch = getScapeHatch();
    require(scapeHatch > 0); // check it has been set

    // could go OOG but then you can always split calls in multiple calls with subsets of tokens
    for (uint i = 0; i < _tokens.length; i++) {
      address token = _tokens[i];
      doTransfer(token, scapeHatch, getTokenBalance(token));
    }
  }

  function setScapeHatch(address _scapeHatch) {
    storageSet(scapeHatchSecondaryKey, uint256(_scapeHatch));
  }

  function getScapeHatch() constant returns (address) {
    return address(storageGet(scapeHatchSecondaryKey));
  }

  function performTokenTransferAccounting(address _token, uint256 _amount, address _to)
           internal
           returns (uint256 newBalance) {
    newBalance = safeSub(getTokenBalance(_token), _amount); // will throw on overflow
    setTokenBalance(_token, newBalance);

    Withdraw(_token, dao_msg().sender, _amount, _to);
  }

  function secureTokenTransfer(address _token, address _to, uint256 _amount)
           max_gas(maxTokenTransferGas)
           internal {
    assert(ERC20(_token).transfer(_to, _amount));
  }

  function storageKeyForBalance(address _token) constant returns (bytes32) {
    return sha3(vaultPrimaryKey, balanceSecondaryKey, _token);
  }

  function setTokenBalance(address _token, uint256 _balance) internal {
    storageSet(storageKeyForBalance(_token), _balance);
  }

  function getTokenBalance(address _token) constant returns (uint256) {
    return storageGet(storageKeyForBalance(_token));
  }

  function getHaltTime() constant returns (uint256 started, uint256 ends) {
    started = storageGet(haltTimeKey);
    ends = safeAdd(started, storageGet(haltDurationKey));
  }

  function organWasInstalled() {
    // TODO: Replace for constant for EtherToken
    MetaOrgan(this).setEtherToken(address(new EtherToken()));
    setReturnSize(getTokenBalanceSig, 32);
    setReturnSize(getHaltTimeSig, 64);  // returns 2 uints
    setReturnSize(getScapeHatchSig, 32);
  }

  function canHandlePayload(bytes _payload) returns (bool) {
    // TODO: Really return true on handleable functions
    bytes4 sig = getFunctionSignature(_payload);
    return
      sig == getTokenBalanceSig ||
      sig == transferSig ||
      sig == transferEtherSig ||
      sig == haltSig ||
      sig == getHaltTimeSig ||
      sig == scapeHatchSig ||
      sig == getScapeHatchSig ||
      sig == setScapeHatchSig;
  }

  function getEtherToken() constant returns (address) {
    return address(storageGet(sha3(0x01, 0x02)));
  }

  modifier only_not_halted() {
    var (,haltEnds) = getHaltTime();
    assert(now >= haltEnds);
    _;
  }

  modifier only_halted() {
    var (,haltEnds) = getHaltTime();
    assert(now < haltEnds);
    _;
  }

  modifier max_gas(uint max_delta) {
    uint initialGas = msg.gas;
    _;
    assert(initialGas - msg.gas < max_delta);
  }
}
