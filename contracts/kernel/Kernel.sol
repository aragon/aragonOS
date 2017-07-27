pragma solidity ^0.4.11;

import "./IKernel.sol";
import "./KernelRegistry.sol";

import "../tokens/EtherToken.sol";
import "zeppelin/token/ERC20.sol";

import "../dao/DAOStorage.sol";
import "../apps/Application.sol";
import "../apps/accounting/AccountingApp.sol";

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

contract Kernel is IKernel, DAOStorage, KernelRegistry {
    address public deployedMeta;

    bytes4 constant INSTALL_ORGAN_SIG = bytes4(sha3('installOrgan(address,bytes4[])'));
    bytes4 constant DEPOSIT_SIG = bytes4(sha3('deposit(address,uint256)'));
    bytes4 constant NEW_TRANSACTION_SIG = bytes4(sha3('newTransaction(address,address,int256,string)'));

    function Kernel(address _deployedMeta) {
        deployedMeta = _deployedMeta;
    }

    // @dev Installs 'installOrgan' function from MetaOrgan.
    // @param _baseKernel an instance to the kernel to call.
    function setupOrgans(address _baseKernel) {
        var (a,) = get(INSTALL_ORGAN_SIG);
        require(a == 0); // assert this can only be called once in the DAO
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
        recordDeposit(sender, token, value, "new deposit"); // recored the token deposit
        if (payload.length == 0) return; // Just receive the tokens

        bytes4 sig;
        assembly { sig := mload(add(payload, 0x20)) }
        var (target, isDelegate) = get(sig);
        uint32 len = RETURN_MEMORY_SIZE;
        require(target > 0);

        // TODO: Make it a switch statement when truffle migrates to solc 0.4.12
        if (isDelegate) {
            setDAOMsg(DAOMessage(sender, token, value)); // save context so organs can access it
            assembly {
                let result := 0
                result := delegatecall(sub(gas, 10000), target, add(payload, 0x20), mload(payload), 0, len)
                jumpi(invalidJumpLabel, iszero(result))
                return(0, len)
            }
        } else {
            Application(target).setDAOMsg(sender, token, value);
            assembly {
                let result := 0
                result := call(sub(gas, 10000), target, 0, add(payload, 0x20), mload(payload), 0, len)
                jumpi(invalidJumpLabel, iszero(result))
                return(0, len)
            }
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
        var (vaultOrgan,) = get(DEPOSIT_SIG);
        if (amount == 0 || vaultOrgan == 0) return;
        assert(vaultOrgan.delegatecall(DEPOSIT_SIG, uint256(token), amount)); 
    }

	event DebugString(string msg, string msg2);
	event DebugUint(string msg, uint msg2);
	event DebugAddress(string msg, address msg2);
	function recordDeposit(address sender, address token, uint256 amount, string ref) {
		var (accountingApp,) = get(NEW_TRANSACTION_SIG);
        if (amount == 0 || accountingApp == 0) return;
		DebugUint('recordDeposit amount', amount);
		DebugAddress('recordDeposit accountingApp', accountingApp);
		DebugString('recordDeposit', ref);
		//assert(accountingApp.call(NEW_TRANSACTION_SIG, sender, token, amount, ref));  // newTransaction(address,address,int256,string)
	}

    function getPermissionsOracle() constant returns (address) {
        return address(storageGet(sha3(0x01, 0x03)));
    }

    function payload(bytes data, uint nonce) constant public returns (bytes32) {
        return keccak256(address(this), data, nonce);
    }

    function personalSignedPayload(bytes data, uint nonce) constant public returns (bytes32) {
        return keccak256(0x19, "Ethereum Signed Message:\n32", payload(data, nonce));
    }
}
