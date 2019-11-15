/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.5.1;


interface IEVMScriptExecutor {
    function execScript(bytes calldata script, bytes calldata input, address[] calldata blacklist) external returns (bytes memory);
    function executorType() external pure returns (bytes32);
}
