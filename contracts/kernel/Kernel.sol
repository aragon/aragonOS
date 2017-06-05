pragma solidity ^0.4.11;

import "./AbstractKernel.sol";
import "./organs/DispatcherOrgan.sol";
import "./organs/MetaOrgan.sol";

import "../tokens/EtherToken.sol";
import "zeppelin/token/ERC20.sol";

import "../dao/DAOStorage.sol";

// @dev Kernel's purpose is to intercept different types of transactions that can
// be made to the DAO, and dispatch it using a uniform interface to the DAO organs.
// The Kernel keeps a registry what organ lives at x priority.

// Accepted transaction types:
//   - Vanilla ether tx: transfering ETH with the value param of the tx and tx data.
//   - Pre signed ether tx: providing the ECDSA signature of the payload.
//     allows for preauthorizing a tx that could be sent by other msg.sender
//   - Token tx: approveAndCall and EIP223 tokenFallback support
contract Kernel is AbstractKernel, DAOStorage {
  // @dev Constructor deploys the basic contracts the kernel needs to function
  function setupOrgans() {
    setOrgan(1, new DispatcherOrgan());
    setOrgan(2, new MetaOrgan());
    setReturnSize(0x877d08ee, 32); // getEtherToken(...): returns address
  }

  // @dev Vanilla ETH transfers get intercepted in the fallback
  function () payable public {
    dispatchEther(msg.sender, msg.value, msg.data);
  }

  // @dev Dispatch a preauthorized ETH transaction
  // @param data: Presigned transaction data to be executed
  // @param nonce: Numeric identifier that allows for multiple tx with the same data to be executed.
  // @param r: ECDSA signature r value
  // @param s: ECDSA signature s value
  // @param v: ECDSA signature v value
  function preauthDispatch(bytes data, uint nonce, bytes32 r, bytes32 s, uint8 v) payable public {
    bytes32 signingPayload = payload(data, nonce); // Calculate the hashed payload that was signed
    require(!isUsedPayload(signingPayload));

    address sender = ecrecover(signingPayload, v, r, s);
    dispatchEther(sender, msg.value, data);
    setUsedPayload(signingPayload);
  }

  // EIP223 receiver compatible
  function tokenFallback(address _sender, address _origin, uint256 _value, bytes _data) public returns (bool ok) {
    dispatch(_sender, msg.sender, _value, _data);
    return true;
  }

  // ApproveAndCall compatible
  function receiveApproval(address _sender, uint256 _value, address _token, bytes _data) public {
    assert(ERC20(_token).transferFrom(_sender, address(this), _value));
    dispatch(_sender, _token, _value, _data);
  }

  // @dev For ETH transactions this function wraps the ETH in a token and dispatches it
  // @param sender: msg.sender of the transaction
  // @param value: Transaction's sent ETH value
  // @param data: Transaction data
  function dispatchEther(address sender, uint256 value, bytes data) internal {
    address etherTokenAddress = getEtherToken();
    if (value > 0 && etherTokenAddress != 0) EtherToken(etherTokenAddress).wrapEther.value(value)();
    dispatch(sender, etherTokenAddress, value, data);
  }

  // @dev Sends the transaction to the dispatcher organ
  function dispatch(address sender, address token, uint256 value, bytes payload) internal {
    require(canPerformAction(sender, token, value, payload));
    // dao_msg = DAOMessage(sender, token, value); // set dao_msg for other organs to have access

    // performedAction(sender, token, value, data); // TODO: Check reentrancy implications
    address target = getDispatcherOrgan();
    uint32 len = getReturnSize(msg.sig);
    assembly {
      let result := delegatecall(sub(gas, 10000), target, add(payload, 0x20), mload(payload), 0, len)
      jumpi(invalidJumpLabel, iszero(result))
      return(0, len)
    }
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    return true; // getDispatcherOrgan().canPerformAction(sender, token, value, data);
  }

  function performedAction(address sender, address token, uint256 value, bytes data) {
    getDispatcherOrgan().performedAction(sender, token, value, data);
  }

  function setUsedPayload(bytes32 _payload) internal {
    storageSet(getStorageKeyForPayload(_payload), 1);
  }

  function isUsedPayload(bytes32 _payload) constant returns (bool) {
    return storageGet(getStorageKeyForPayload(_payload)) == 1;
  }

  function getStorageKeyForPayload(bytes32 _payload) constant internal returns (bytes32) {
    return sha3(0x01, 0x01, _payload);
  }

  function getEtherToken() returns (address) {
    return address(storageGet(sha3(0x01, 0x02)));
  }

  function getOrgan(uint _organId) returns (address organAddress) {
    return address(storageGet(getStorageKeyForOrgan(_organId)));
  }

  function setOrgan(uint _organId, address _organAddress) internal {
    storageSet(getStorageKeyForOrgan(_organId), uint256(_organAddress));
  }

  function getStorageKeyForOrgan(uint _organId) internal returns (bytes32) {
    return sha3(0x01, 0x00, _organId);
  }

  function getDispatcherOrgan() internal returns (DispatcherOrgan) {
    return DispatcherOrgan(getOrgan(1));
  }

  function payload(bytes data, uint nonce) constant public returns (bytes32) {
    return keccak256(0x19, "Ethereum Signed Message:\n40Preauth ", keccak256(address(this), data, nonce)); // length = 8 ('preauth ') + 32 (sha3 hash)
  }
}
