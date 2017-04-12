pragma solidity ^0.4.8;

import "./AbstractDAOKernel.sol";
import "./organs/DispatcherOrgan.sol";
import "./organs/MetaOrgan.sol";

contract DAOKernel is AbstractDAOKernel {
  function DAOKernel() {
    organs[1] = address(new DispatcherOrgan());
    organs[2] = address(new MetaOrgan());
  }

  function () payable {
    dispatch(msg.sender, msg.value, msg.data);
  }

  function preauthDispatch(bytes data, uint nonce, bytes32 r, bytes32 s, uint8 v) payable {
    bytes32 signingPayload = payload(data, nonce);
    if (usedSignatures[signingPayload]) throw;
    address sender = ecrecover(signingPayload, v, r, s);
    usedSignatures[signingPayload] = true;

    dispatch(sender, msg.value, data);
  }

  function dispatch(address sender, uint256 value, bytes data) private {
    if (!canPerformAction(sender, value, data)) throw;
    if (!getDispatcherOrgan().delegatecall(data)) throw;
  }

  function canPerformAction(address sender, uint256 value, bytes data) returns (bool) {
    return getDispatcherOrgan().canPerformAction(sender, value, data);
  }

  function getOrgan(uint organN) returns (address organAddress) {
    return organs[organN];
  }

  function getDispatcherOrgan() internal returns (DispatcherOrgan) {
    return DispatcherOrgan(getOrgan(1));
  }

  function payload(bytes data, uint nonce) constant public returns (bytes32) {
    return keccak256(0x19, "Ethereum Signed Message:\n40Preauth ", keccak256(address(this), data, nonce)); // length = 8 ('preauth ') + 20 (sha3 hash)
  }
}
