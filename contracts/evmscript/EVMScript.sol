pragma solidity 0.4.18;

import "./ScriptHelpers.sol";

import "./specs/EVMCallScript.sol";
import "./specs/DelegateScript.sol";


contract EVMScriptExec is ScriptHelpers, EVMCallScriptRunner, DelegateScript {
    event ExecuteScript(address indexed sender, uint32 indexed spec, bytes32 scriptHash);

    uint32 constant LAST_EVMSCRIPT_SPEC = DelegateScript.SPEC_ID;

    /**
    * @notice Executes script. First 32 bits are the spec version
    */
    function execScript(bytes script) internal {
        uint32 spec = getSpecId(script);
        require(spec > 0 && spec <= LAST_EVMSCRIPT_SPEC);

        if (spec == EVMCallScriptRunner.SPEC_ID) EVMCallScriptRunner.execScript(script);
        if (spec == DelegateScript.SPEC_ID) DelegateScript.execScript(script);

        ExecuteScript(msg.sender, spec, keccak256(script));
    }
}
