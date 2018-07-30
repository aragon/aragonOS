/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "./IEVMScriptExecutor.sol";


contract EVMScriptRegistryConstants {
    /* Hardcoded constants to save gas
    bytes32 constant public APP_ADDR_NAMESPACE = keccak256("app");

    bytes32 constant public EVMSCRIPT_REGISTRY_APP_ID = apmNamehash("evmreg");
    bytes32 constant public EVMSCRIPT_REGISTRY_APP = keccak256(APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID);
    */
    bytes32 constant public EVMSCRIPT_REGISTRY_APP_ID = 0xddbcfd564f642ab5627cf68b9b7d374fb4f8a36e941a75d89c87998cef03bd61;
    bytes32 constant public EVMSCRIPT_REGISTRY_APP = 0x34f01c17e9be6ddbf2c61f37b5b1fb9f1a090a975006581ad19bda1c4d382871;
}


interface IEVMScriptRegistry {
    function addScriptExecutor(IEVMScriptExecutor executor) external returns (uint id);
    function disableScriptExecutor(uint256 executorId) external;

    function getScriptExecutor(bytes script) public view returns (IEVMScriptExecutor);
}
