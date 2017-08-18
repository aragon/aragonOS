pragma solidity ^0.4.13;

/**
* @title DAO Kernel
* @author Jorge Izquierdo (Aragon)
* @description Kernel's purpose is to intercept different types of transactions that can
* be made to the DAO, check if the action can be done and dispatch it.
* The Kernel keeps a registry what organ or applications handles each action.
*/

import "./IKernel.sol";
import "./KernelRegistry.sol";
import "./IPermissionsOracle.sol";
import "../misc/DAOMsg.sol";

import "../tokens/EtherToken.sol";
import "zeppelin/token/ERC20.sol";

import "../organs/IOrgan.sol";
import "../apps/Application.sol";

contract Kernel is IKernel, IOrgan, KernelRegistry, DAOMsgEncoder {
    /**
    * @dev MetaOrgan instance keeps saved in its own context.
    * @param _deployedMeta an instance of a MetaOrgan (used for setup)
    */
    function Kernel(address _deployedMeta) {
        deployedMeta = _deployedMeta;
    }

    /**
    * @dev Registers 'installOrgan' function from MetaOrgan, all further organ installs can be performed with it
    * @param _baseKernel an instance to the kernel to call and get the deployedMeta
    */
    function setupOrgans(address _baseKernel) {
        var (a,) = get(INSTALL_ORGAN_SIG);
        require(a == 0); // assert this can only be called once in the DAO
        bytes4[] memory installOrganSig = new bytes4[](1);
        installOrganSig[0] = INSTALL_ORGAN_SIG;
        register(Kernel(_baseKernel).deployedMeta(), installOrganSig, true);
    }

    /**
    * @dev Vanilla ETH transfers get intercepted in the fallback
    */
    function () payable public {
        dispatchEther(msg.sender, msg.value, msg.data);
    }

    /**
    * @notice Send a transaction of behalf of the holder that signed it (data: `data`)
    * @dev Dispatches a preauthorized ETH transaction
    * @param _data Presigned transaction data to be executed
    * @param _nonce Numeric identifier that allows for multiple tx with the same data to be executed.
    * @param _r ECDSA signature r value
    * @param _s ECDSA signature s value
    * @param _v ECDSA signature v value
    */
    function preauthDispatch(bytes _data, uint _nonce, bytes32 _r, bytes32 _s, uint8 _v) payable public {
        bytes32 signingPayload = personalSignedPayload(_data, _nonce); // Calculate the hashed payload that was signed
        require(!isUsedPayload(signingPayload));
        setUsedPayload(signingPayload);

        address signer = ecrecover(signingPayload, _v, _r, _s);
        dispatchEther(signer, msg.value, _data);
    }

    /**
    * @dev ERC223 receiver compatible
    * @param _sender address that performed the token transfer (only trustable if token is trusted)
    * @param _origin address from which the tokens came from (same as _sender unless transferFrom)
    * @param _value amount of tokens being sent
    * @param _data executable data alonside token transaction
    */
    function tokenFallback(address _sender, address _origin, uint256 _value, bytes _data) public returns (bool ok) {
        _origin; // silence unused variable warning
        dispatch(_sender, msg.sender, _value, _data);
        return true;
    }

    /**
    * @dev ApproveAndCall compatibility
    * @param _sender address that performed the token transfer (only trustable if token is trusted)
    * @param _value amount of tokens being sent
    * @param _token token address (same as msg.sender)
    * @param _data executable data alonside token transaction
    */
    function receiveApproval(address _sender, uint256 _value, address _token, bytes _data) public {
        assert(ERC20(_token).transferFrom(_sender, address(this), _value));
        // We can only trust the values sent for sender and data when the sender is the token (assures a trustless approveAndCall happened)
        // This still allows to do an external approveAndCall for just depositing the tokens (w/o execution but w/ accounting)
        // Ref: https://github.com/aragon/aragon-core/issues/72#issuecomment-321508691
        dispatch(_token == msg.sender ? _sender : msg.sender, _token, _value, _token == msg.sender ? _data : new bytes(0));
      }

    /**
    * @dev For ETH transactions this function wraps the ETH in a token and dispatches it
    * @param _sender address that performed the ether transfer
    * @param _value amount of tokens being sent
    * @param _data executable data alonside token transaction
    */
    function dispatchEther(address _sender, uint256 _value, bytes _data) internal {
        // dispatched token address is 0, this is intercepted by the Vault
        dispatch(_sender, 0, _value, _data);
    }

    /**
    * @dev Sends the transaction to the dispatcher organ
    * @param _sender address that performed the token transfer
    * @param _token token address
    * @param _value amount of tokens being sent
    * @param _payload executable data alonside token transaction
    * @return - the underlying call returns (upto RETURN_MEMORY_SIZE memory)
    */
    function dispatch(address _sender, address _token, uint256 _value, bytes _payload) internal {

        vaultDeposit(_sender, _token, _value); // deposit tokens that come with the call in the vault


        if (_payload.length == 0)
          return; // Just receive the tokens

        require(canPerformAction(_sender, _token, _value, _payload));

        bytes4 sig;
        assembly { sig := mload(add(_payload, 0x20)) }
        var (target, isDelegate) = get(sig);
        uint32 len = RETURN_MEMORY_SIZE;

        require(target > 0);

        bytes memory payloadMsg = calldataWithDAOMsg(_payload, _sender, _token, _value);

        assembly {
            let result := 0

            switch isDelegate
            case 1 { result := delegatecall(sub(gas, 10000), target, add(payloadMsg, 0x20), mload(payloadMsg), 0, len) }
            case 0 { result := call(sub(gas, 10000), target, 0, add(payloadMsg, 0x20), mload(payloadMsg), 0, len) }
            switch result case 0 { invalid() }
            return(0, len)
        }
    }

    /**
    * @dev Sends the transaction to the dispatcher organ
    * @param _sender address that performed the token transfer
    * @param _token token address
    * @param _value amount of tokens being sent
    * @param _data executable data alonside token transaction
    * @return bool whether the action is allowed by permissions oracle
    */
    function canPerformAction(address _sender, address _token, uint256 _value, bytes _data) constant returns (bool) {
        address p = getPermissionsOracle();
        return p == 0 || IPermissionsOracle(p).canPerformAction(_sender, _token, _value, _data);
    }

    /**
    * @dev Low level deposit of funds to the Vault Organ
    * @param _sender address that performed the token transfer
    * @param _token address of the token
    * @param _amount amount of the token
    */
    function vaultDeposit(address _sender, address _token, uint256 _amount) internal {
        var (vaultOrgan,) = get(DEPOSIT_SIG);
        if (_amount == 0 || vaultOrgan == 0)
          return;

        assert(vaultOrgan.delegatecall(DEPOSIT_SIG, uint256(_sender), uint256(_token), _amount));
    }

    /**
    * @dev Sets a preauth payload as used
    * @param _payload hash of the action used
    */
    function setUsedPayload(bytes32 _payload) internal {
        storageSet(getStorageKeyForPayload(_payload), 1);
    }

    /**
    * @dev Whether a given preauth payload was already used
    * @param _payload hash of the action used
    * @return bool was payload it was used before or not
    */
    function isUsedPayload(bytes32 _payload) constant returns (bool) {
        return storageGet(getStorageKeyForPayload(_payload)) == 1;
    }

    /**
    * @dev Compute payload to be signed in order to preauthorize a transaction
    * @param _data transaction data to be executed
    * @param _nonce identifier of the transaction to allow repeating actions without double-spends
    * @return bytes32 hash to be signed
    */
    function personalSignedPayload(bytes _data, uint _nonce) constant public returns (bytes32) {
        return keccak256(0x19, "Ethereum Signed Message:\n32", payload(_data, _nonce));
    }

    function payload(bytes _data, uint _nonce) constant public returns (bytes32) {
        return keccak256(address(this), _data, _nonce);
    }

    function getStorageKeyForPayload(bytes32 _payload) constant internal returns (bytes32) {
        return sha3(0x01, 0x01, _payload);
    }

    function getPermissionsOracle() constant returns (address) {
        return address(storageGet(sha3(0x01, 0x03)));
    }

    address public deployedMeta;
    bytes4 constant INSTALL_ORGAN_SIG = bytes4(sha3('installOrgan(address,bytes4[])'));
    bytes4 constant DEPOSIT_SIG = bytes4(sha3('deposit(address,address,uint256)'));
}
