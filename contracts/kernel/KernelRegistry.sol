pragma solidity ^0.4.11;

import "../dao/DAOStorage.sol";


contract KernelRegistry is DAOStorage {
    function get(bytes4 _sig) constant returns (address, bool) {
        uint v = storageGet(storageKeyForSig(_sig));
        bool isDelegate = v >> 8 * 20 == 1;
        return (address(v), isDelegate);
    }

    function storageKeyForSig(bytes4 _sig) internal returns (bytes32) {
        return sha3(0x01, 0x00, _sig);
    }

    function register(address impl, bytes4[] sigs, bool delegate) internal {
        uint addDelegate = delegate ? 2 ** 8 ** 20 : 0;
        storageSet(storageKeyForSig(bytes4(sha3(sigs))), identifier(delegate));

        for (uint i = 0; i < sigs.length; i++) {
            require(delegate || storageGet(storageKeyForSig(sigs[i])) == 0); // don't allow to overwrite on apps
            require(i == 0 || sigs[i] > sigs[i - 1]); // assert sigs are ordered
            storageSet(storageKeyForSig(sigs[i]), uint(address(impl)) + addDelegate);
        }
    }

    function deregister(bytes4[] sigs, bool delegate) internal {
        // performs integrity check (all sigs being removed) and allows double auth for organs or apps
        require(storageGet(storageKeyForSig(bytes4(sha3(sigs)))) == identifier(delegate));
        for (uint i = 0; i < sigs.length; i++) {
            storageSet(storageKeyForSig(sigs[i]), 0);
        }
    }

    function identifier(bool isDelegate) internal returns (uint) {
        return isDelegate ? 2 : 1;
    }
}
