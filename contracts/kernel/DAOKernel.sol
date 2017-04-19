pragma solidity ^0.4.8;

import "./AbstractDAOKernel.sol";
import "./organs/DispatcherOrgan.sol";
import "./organs/MetaOrgan.sol";

import "../tokens/EtherToken.sol";
import "zeppelin/token/ERC20.sol";

contract DAOKernel is AbstractDAOKernel {
  function DAOKernel() {
    organs[1] = address(new DispatcherOrgan());
    organs[2] = address(new MetaOrgan());
  }

  function () payable {
    dispatchEther(msg.sender, msg.value, msg.data);
  }

  // ERC23 receiver compatible
  function tokenFallback(address _sender, address _origin, uint256 _value, bytes _data) returns (bool ok) {
    dispatch(_sender, msg.sender, _value, _data);
    return true;
  }

  // ApproveAndCall compatible
  function receiveApproval(address _sender, uint256 _value, address _token, bytes _data) {
    if (!ERC20(_token).transferFrom(_sender, address(this), _value)) throw;
    dispatch(_sender, _token, _value, _data);
  }

  function preauthDispatch(bytes data, uint nonce, bytes32 r, bytes32 s, uint8 v) payable {
    bytes32 signingPayload = payload(data, nonce);
    if (usedSignatures[signingPayload]) throw;

    dispatchEther(ecrecover(signingPayload, v, r, s), msg.value, data);
    usedSignatures[signingPayload] = true;
  }

  function dispatchEther(address sender, uint256 value, bytes data) private {
    if (value == 0) return dispatch(sender, etherToken, value, data); // shortcut

    EtherToken(etherToken).wrapEther.value(value)();
    dispatch(sender, etherToken, value, data);
  }

  function dispatch(address sender, address token, uint256 value, bytes data) private {
    if (!canPerformAction(sender, token, value, data)) throw;
    dao_msg = DAOMessage(sender, token, value);
    if (!getDispatcherOrgan().delegatecall(data)) throw;
    // dao_msg = DAOMessage(0, 0, 0); // zero it for gas refund. will be reset
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) returns (bool) {
    return getDispatcherOrgan().canPerformAction(sender, token, value, data);
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
