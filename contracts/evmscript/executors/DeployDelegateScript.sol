pragma solidity 0.4.18;

import "./DelegateScript.sol";

// Inspired by: https://github.com/dapphub/ds-proxy/blob/master/src/proxy.sol


contract DeployDelegateScript is DelegateScript {
    uint256 constant internal SCRIPT_START_LOCATION = 4;

    uint256[2**254] private cacheStorageOffset;
    mapping (bytes32 => address) cache;

    /**
    * @notice Executes script by delegatecall into a deployed contract (exec() function)
    * @param _script [ specId (uint32) ][ contractInitcode (bytecode) ]
    * @param _input ABI encoded call to be made to contract (if empty executes default exec() function)
    * @param _blacklist If any address is passed, will revert.
    * @return Call return data
    */
    function execScript(bytes _script, bytes _input, address[] _blacklist) external returns (bytes) {
        require(_blacklist.length == 0); // dont have ability to control bans, so fail.

        bytes32 id = keccak256(_script);
        address deployed = cache[id];
        if (deployed == address(0)) {
            deployed = deploy(_script);
            cache[id] = deployed;
        }

        return DelegateScript.delegate(deployed, _input);
    }

    /**
    * @dev Deploys contract byte code to network
    */
    function deploy(bytes _script) internal returns (address addr) {
        assembly {
            // 0x24 = 0x20 (length) + 0x04 (spec id uint32)
            // Length of code is 4 bytes less than total script size
            addr := create(0, add(_script, 0x24), sub(mload(_script), 0x04))
            switch iszero(extcodesize(addr))
            case 1 { revert(0, 0) } // throw if contract failed to deploy
        }
    }
}
