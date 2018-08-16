/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../../common/Autopetrified.sol";
import "../ScriptHelpers.sol";
import "../IEVMScriptExecutor.sol";


contract BaseEVMScriptExecutor is IEVMScriptExecutor, Autopetrified {
    uint256 constant internal SCRIPT_START_LOCATION = 4;
}
