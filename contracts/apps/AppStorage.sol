/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.24;

import "../common/UnstructuredStorage.sol";
import "../kernel/IKernel.sol";


contract AppStorage {
    using UnstructuredStorage for bytes32;

    /*
    * Hardcoded constants to save gas
    * bytes32 internal constant KERNEL_POSITION = keccak256("aragonOS.appStorage.kernel");
    * bytes32 internal constant APP_ID_POSITION = keccak256("aragonOS.appStorage.appId");
    * bytes32 internal constant VOLATILE_SENDER_POSITION = keccak256("aragonOS.appStorage.volatile.sender");
    */
    bytes32 internal constant KERNEL_POSITION = 0x4172f0f7d2289153072b0a6ca36959e0cbe2efc3afe50fc81636caa96338137b;
    bytes32 internal constant APP_ID_POSITION = 0xd625496217aa6a3453eecb9c3489dc5a53e6c67b444329ea2b2cbc9ff547639b;
    bytes32 internal constant VOLATILE_SENDER_POSITION = 0xd6486d5aa3dac4242db35dd7559408452252cf8050988dbc66956eaa315379ce;

    function kernel() public view returns (IKernel) {
        return IKernel(KERNEL_POSITION.getStorageAddress());
    }

    function appId() public view returns (bytes32) {
        return APP_ID_POSITION.getStorageBytes32();
    }

    function volatileStorageSender() public view returns (address) {
        return VOLATILE_SENDER_POSITION.getStorageAddress();
    }

    function setKernel(IKernel _kernel) internal {
        KERNEL_POSITION.setStorageAddress(address(_kernel));
    }

    function setAppId(bytes32 _appId) internal {
        APP_ID_POSITION.setStorageBytes32(_appId);
    }

    function setVolatileStorageSender(address _sender) internal {
        VOLATILE_SENDER_POSITION.setStorageAddress(_sender);
    }
}
