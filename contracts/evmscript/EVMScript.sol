pragma solidity 0.4.18;

import "./ScriptHelpers.sol";

import "./specs/CallsScript.sol";
import "./specs/DelegateScript.sol";
import "./specs/DeployDelegateScript.sol";


contract EVMScript is CallsScript, DelegateScript, DeployDelegateScript {
    using ScriptHelpers for bytes;

    event ExecuteScript(address indexed sender, uint32 indexed spec, bytes32 scriptHash);

    uint32 constant LAST_SPEC_ID = DeployDelegateScript.SPEC_ID;

    /**
    * @notice Executes script. First 32 bits are the spec version
    * @param script EVMScript to be run
    * @param bannedAddrs Addresses that cannot be interacted with from scripts
    *        in case of not being able to control addresses that will be interacted
    *        with (eg. spec delegatecalls), the script will fail.
    *        Example: this prevents a script in a token manager from transfering tokens
    * @dev After script is executed, some basic checks should be done to ensure some
    *      critical storage slots have been modified (for example: kernel and appid refs)
    */
    function execScript(bytes script, address[] bannedAddrs) internal {
        uint32 spec = script.getSpecId();
        require(spec > 0 && spec <= LAST_SPEC_ID);

        // Exec in spec
        if (spec == CallsScript.SPEC_ID) CallsScript.execScript(script, bannedAddrs); // solium-disable-line lbrace
        if (spec == DelegateScript.SPEC_ID) DelegateScript.execScript(script, bannedAddrs); // solium-disable-line lbrace
        if (spec == DeployDelegateScript.SPEC_ID) DeployDelegateScript.execScript(script, bannedAddrs); // solium-disable-line lbrace

        ExecuteScript(msg.sender, spec, keccak256(script));
    }
}
