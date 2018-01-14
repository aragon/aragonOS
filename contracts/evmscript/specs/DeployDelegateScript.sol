pragma solidity 0.4.18;

import "./DelegateScript.sol";

// Inspired by: https://github.com/dapphub/ds-proxy/blob/master/src/proxy.sol


contract DeployDelegateScript is DelegateScript {
    uint32 constant SPEC_ID = 3;
    /**
    * @notice Executes script by delegatecall into a deployed contract (exec() function)
    * @param script [ specId (uint32 = 3) ][ contractInitcode (bytecode) ]
    * @param input ABI encoded call to be made to contract (if empty executes default exec() function)
    * @param banned If any address is passed, will revert.
    * @param input ABI encoded call to be made to contract
    * @return Call return data
    */
    function execScript(bytes memory script, bytes memory input, address[] memory banned) internal returns (bytes memory output) {
        require(banned.length == 0); // dont have ability to control bans, so fail.

        address deployed = deploy(script); // TODO: Add cache
        return DelegateScript.delegate(deployed, input);
    }

    /**
    * @dev Deploys contract byte code to network
    */
    function deploy(bytes script) internal returns (address addr) {
        assembly {
            // 0x24 = 0x20 (length) + 0x04 (spec id uint32)
            // Length of code is 4 bytes less than total script size
            addr := create(0, add(script, 0x24), sub(mload(script), 0x04))
            switch iszero(extcodesize(addr))
            case 1 { revert(0, 0) } // throw if contract failed to deploy
        }
    }
}
