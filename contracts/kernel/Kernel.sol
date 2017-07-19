pragma solidity ^0.4.11;

import "./IKernel.sol";
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

contract PermissionsOracle {
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool);
}

contract Kernel is IKernel, DAOStorage, FunctionRegistry {
  address public deployedMeta;

  bytes4 constant INSTALL_ORGAN_SIG = 0x12;

  function Kernel(address _deployedMeta) {
    deployedMeta = _deployedMeta;
  }

  // @dev Installs 'installOrgan' function from MetaOrgan.
  // @param _baseKernel an instance to the kernel to call.
  function setupOrgans(address _baseKernel) {
    bytes4[] memory installOrganSig = new bytes4[](1);
    installOrganSig[0] = INSTALL_ORGAN_SIG;
    register(Kernel(_baseKernel).deployedMeta(), installOrganSig, true);
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
    bytes32 signingPayload = personalSignedPayload(data, nonce); // Calculate the hashed payload that was signed
    require(!isUsedPayload(signingPayload));
    setUsedPayload(signingPayload);

    address sender = ecrecover(signingPayload, v, r, s);
    dispatchEther(sender, msg.value, data);
  }

  // ERC223 receiver compatible
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
    dispatch(sender, 0, value, data);
  }

  // @dev Sends the transaction to the dispatcher organ
  function dispatch(address sender, address token, uint256 value, bytes payload) internal {
    require(canPerformAction(sender, token, value, payload));

    vaultDeposit(token, value); // deposit tokens that come with the call in the vault

    if (payload.length == 0) return; // Just receive the tokens

    setDAOMsg(DAOMessage(sender, token, value)); // save context so organs can access it

    address target = DispatcherOrgan(getOrgan(1)); // dispatcher is always organ #1
    uint32 len = getReturnSize();
    assembly {
      let result := delegatecall(sub(gas, 10000), target, add(payload, 0x20), mload(payload), 0, len)
      jumpi(invalidJumpLabel, iszero(result))
      return(0, len)
    }
  }

  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    address p = getPermissionsOracle();
    return p == 0 ? true : PermissionsOracle(p).canPerformAction(sender, token, value, data);
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

  function vaultDeposit(address token, uint256 amount) internal {
    address vaultOrgan = getOrgan(3);
    if (amount == 0 || vaultOrgan == 0) return;

    assert(vaultOrgan.delegatecall(0x47e7ef24, uint256(token), amount)); // deposit(address,uint256)
  }

  function getPermissionsOracle() constant returns (address) {
    return address(storageGet(sha3(0x01, 0x03)));
  }

  function getOrgan(uint _organId) constant returns (address organAddress) {
    return address(storageGet(getStorageKeyForOrgan(_organId)));
  }

  function setOrgan(uint _organId, address _organAddress) internal {
    storageSet(getStorageKeyForOrgan(_organId), uint256(_organAddress));
  }

  function getStorageKeyForOrgan(uint _organId) internal returns (bytes32) {
    return sha3(0x01, 0x00, _organId);
  }

  function payload(bytes data, uint nonce) constant public returns (bytes32) {
    return keccak256(address(this), data, nonce);
  }

  function personalSignedPayload(bytes data, uint nonce) constant public returns (bytes32) {
    return keccak256(0x19, "Ethereum Signed Message:\n32", payload(data, nonce));
  }
}
