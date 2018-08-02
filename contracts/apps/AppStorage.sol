/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../common/UnstructuredStorage.sol";
import "../kernel/IKernel.sol";


contract AppStorage is UnstructuredStorage {
    // keccak256("aragonOS.appStorage.kernel")
    bytes32 internal constant kernelPosition = 0x4172f0f7d2289153072b0a6ca36959e0cbe2efc3afe50fc81636caa96338137b;
    // keccak256("aragonOS.appStorage.appId")
    bytes32 internal constant appIdPosition = 0xd625496217aa6a3453eecb9c3489dc5a53e6c67b444329ea2b2cbc9ff547639b;
    // keccak256("aragonOS.appStorage.pinnedCode"), used by Proxy Pinned
    bytes32 internal constant pinnedCodePosition = 0xdee64df20d65e53d7f51cb6ab6d921a0a6a638a91e942e1d8d02df28e31c038e;

    function kernel() public view returns (IKernel) {
        return IKernel(getStorageAddress(kernelPosition));
    }

    function appId() public view returns (bytes32) {
        return getStorageBytes32(appIdPosition);
    }

    function setKernel(IKernel _kernel) internal {
        setStorageAddress(kernelPosition, address(_kernel));
    }

    function setAppId(bytes32 _appId) internal {
        setStorageBytes32(appIdPosition, _appId);
    }

    function setPinnedCode(address _pinnedCode) internal {
        setStorageAddress(pinnedCodePosition, _pinnedCode);
    }

    function pinnedCode() internal view returns (address) {
        return getStorageAddress(pinnedCodePosition);
    }
}
