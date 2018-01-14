pragma solidity 0.4.18;

import "./ScriptHelpers.sol";

import "./specs/CallsScript.sol";
import "./specs/DelegateScript.sol";
import "./specs/DeployDelegateScript.sol";

import "../apps/AppStorage.sol";


contract EVMScript is AppStorage, CallsScript, DelegateScript, DeployDelegateScript {
    using ScriptHelpers for bytes;

    event ExecuteScript(address indexed sender, uint32 indexed spec, bytes32 scriptHash);

    uint32 constant LAST_SPEC_ID = DeployDelegateScript.SPEC_ID;

    /**
    * @notice Executes script. First 32 bits are the spec version
    * @param script EVMScript to be run
    * @param input ABI encoded array of bytes passed to the script
    * @param bannedAddrs Addresses that cannot be interacted with from scripts
    *        in case of not being able to control addresses that will be interacted
    *        with (eg. spec delegatecalls), the script will fail.
    *        Example: this prevents a script in a token manager from transfering tokens
    * @dev After script is executed, some basic checks should be done to ensure some
    *      critical storage slots have been modified (for example: kernel and appid refs)
    */
    function execScript(bytes memory script, bytes memory input, address[] bannedAddrs) protectState internal returns (bytes output) {
        uint32 spec = script.getSpecId();
        require(spec > 0 && spec <= LAST_SPEC_ID);


        ExecuteScript(msg.sender, spec, keccak256(script));

        // Exec in spec
        if (spec == CallsScript.SPEC_ID) return CallsScript.execScript(script, input, bannedAddrs); // solium-disable-line lbrace
        if (spec == DelegateScript.SPEC_ID) return DelegateScript.execScript(script, input, bannedAddrs); // solium-disable-line lbrace
        if (spec == DeployDelegateScript.SPEC_ID) return DeployDelegateScript.execScript(script, input, bannedAddrs); // solium-disable-line lbrace
    }

    // Some apps will need to have extended state protection
    modifier protectState {
        address preKernel = kernel;
        bytes32 preAppId = appId;
        _; // exec
        require(kernel == preKernel);
        require(appId == preAppId);
    }
}
