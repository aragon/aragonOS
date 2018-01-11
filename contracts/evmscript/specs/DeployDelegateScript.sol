pragma solidity 0.4.18;

import "./DelegateScript.sol";

// Inspired by: https://github.com/dapphub/ds-proxy/blob/master/src/proxy.sol


contract DeployDelegateScript is DelegateScript {
    uint32 constant SPEC_ID = 3;
    /**
    * @notice Executes script by delegatecall into a deployed contract (exec() function)
    * @param script [ specId (uint32 = 3) ][ contractInitcode (bytecode) ]
    * @param banned If any address is passed, will revert.
    */
    function execScript(bytes memory script, address[] memory banned) internal {
        require(banned.length == 0); // dont have ability to control bans, so fail.

        address deployed = create(script);
        DelegateScript.delegate(deployed);
    }

    /**
    * @dev Deploy a contract from a script
    */
    function create(bytes script) internal returns (address addr) {
        assembly {
            // 0x24 = 0x20 (length) + 0x04 (spec id uint32)
            // Length of code is 4 bytes less than total script size
            addr := create(0, add(script, 0x24), sub(mload(script), 0x04))
            switch iszero(extcodesize(addr))
            case 1 { revert(0, 0) } // throw if contract failed to deploy
        }
    }
}
