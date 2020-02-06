/*
 * SPDX-License-Identifier:    MIT
 */

pragma solidity ^0.4.24;

import "../../common/Autopetrified.sol";
import "../IEVMScriptExecutor.sol";


contract BaseEVMScriptExecutor is IEVMScriptExecutor, Autopetrified {
    uint256 internal constant SCRIPT_START_LOCATION = 4;
}
