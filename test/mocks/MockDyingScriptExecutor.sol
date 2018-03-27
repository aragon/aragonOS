pragma solidity 0.4.18;

import "../../contracts/evmscript/IEVMScriptExecutor.sol";


contract MockDyingScriptExecutor is IEVMScriptExecutor {
    function execScript(bytes script, bytes input, address[] blacklist) external returns (bytes) {
        if (input.length > 0) selfdestruct(address(0));

        return new bytes(1);
    }
}
