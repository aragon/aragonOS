pragma solidity ^0.4.11;

import "./AbstractKernel.sol";
import "./organs/DispatcherOrgan.sol";
import "./organs/MetaOrgan.sol";

import "../tokens/EtherToken.sol";
import "zeppelin/token/ERC20.sol";

// @dev Kernel's purpose is to intercept different types of transactions that can
// be made to the DAO, and dispatch it using a uniform interface to the DAO organs.
// The Kernel keeps a registry what organ lives at x priority.

// Accepted transaction types:
//   - Vanilla ether tx: transfering ETH with the value param of the tx and tx data.
//   - Pre signed ether tx: providing the ECDSA signature of the payload.
//     allows for preauthorizing a tx that could be sent by other msg.sender
//   - Token tx: approveAndCall and EIP223 tokenFallback support
contract Kernel is AbstractKernel {
  // @dev Constructor deploys the basic contracts the kernel needs to function
  function Kernel() {
    organs[1] = address(new DispatcherOrgan());
    organs[2] = address(new MetaOrgan());
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
    require(!usedSignatures[signingPayload]);

    address sender = ecrecover(signingPayload, v, r, s);
    dispatchEther(sender, msg.value, data);
    usedSignatures[signingPayload] = true;
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
    if (value > 0) EtherToken(etherToken).wrapEther.value(value)();
    dispatch(sender, etherToken, value, data);
  }

  // @dev Sends the transaction to the dispatcher organ
  function dispatch(address sender, address token, uint256 value, bytes data) internal {
    require(canPerformAction(sender, token, value, data));
    dao_msg = DAOMessage(sender, token, value); // set dao_msg for other organs to have access

    performedAction(sender, token, value, data); // TODO: Check reentrancy implications
    assert(getDispatcherOrgan().delegatecall(data));
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return getDispatcherOrgan().canPerformAction(sender, token, value, data);
  }

  function performedAction(address sender, address token, uint256 value, bytes data) {
    getDispatcherOrgan().performedAction(sender, token, value, data);
  }

  function getOrgan(uint organN) returns (address organAddress) {
    return organs[organN];
  }

  function getDispatcherOrgan() internal returns (DispatcherOrgan) {
    return DispatcherOrgan(getOrgan(1));
  }

  function payload(bytes data, uint nonce) constant public returns (bytes32) {
    return keccak256(0x19, "Ethereum Signed Message:\n40Preauth ", keccak256(address(this), data, nonce)); // length = 8 ('preauth ') + 32 (sha3 hash)
  }
}
