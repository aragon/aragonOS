pragma solidity ^0.4.11;

import "./IKernelRegistry.sol";
import "../dao/DAOStorage.sol";

contract KernelRegistry is IKernelRegistry, DAOStorage {
    /**
    @dev Get dispatching information about a given signature
    @param _sig The first 4 bytes of the hash of the function signature in question
    @return address Component of the DAO that dispatches the signature (0 if none)
    @return bool Whether the action is dispatched with a delegate call (true = delegatecall (organ), false = call (app))
    */
    function get(bytes4 _sig) constant returns (address, bool) {
        uint v = storageGet(storageKeyForSig(_sig));
        bool isDelegate = v >> 8 * 20 == 1;
        return (address(v), isDelegate);
    }

    /**
    @dev Register a set of function signatures to a given component address. Apps cannot overwrite existing signatures without deregistering first
    @param _comp Address of the component that will handle the function signatures
    @param _sigs The first 4 bytes of the hash of the function signatures being registered. Must be ordered (0x10 before 0x20 and so on)
    @param _delegate Whether to register as delegate callable or not (true = organ, false = app)
    */
    function register(address _comp, bytes4[] _sigs, bool _delegate) internal {
        uint addDelegate = _delegate ? 2 ** 8 ** 20 : 0; // whether is delefare is stored as the 21st byte first bit
        bytes4 id = bytes4(sha3(_sigs));
        storageSet(storageKeyForSig(id), identifier(_delegate));

        for (uint i = 0; i < _sigs.length; i++) {
            require(_delegate || storageGet(storageKeyForSig(_sigs[i])) == 0); // don't allow to overwrite on apps
            require(i == 0 || _sigs[i] > _sigs[i - 1]); // assert sigs are ordered
            storageSet(storageKeyForSig(_sigs[i]), uint(address(_comp)) + addDelegate);
        }

        Register(id, _comp, _delegate);
    }

    /**
    @dev Deegister a set of function signatures
    @param _sigs The first 4 bytes of the hash of the function signatures being registered. Must be the same set of signatures that were registered all together
    @param _delegate Whether signatures were registered as delegate or not
    */
    function deregister(bytes4[] _sigs, bool _delegate) internal {
        bytes4 id = bytes4(sha3(_sigs));
        // performs integrity check (all sigs being removed) and allows double auth for organs or apps
        require(storageGet(storageKeyForSig(id)) == identifier(_delegate));
        for (uint i = 0; i < _sigs.length; i++)
            storageSet(storageKeyForSig(_sigs[i]), 0);

        Deregister(id, _delegate);
    }

    function identifier(bool isDelegate) internal returns (uint) {
        return isDelegate ? 2 : 1;
    }

    function storageKeyForSig(bytes4 _sig) internal returns (bytes32) {
        return sha3(0x01, 0x00, _sig);
    }
}
