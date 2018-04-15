pragma solidity 0.4.18;

import "../../contracts/evmscript/executors/DelegateScript.sol";
import "./Executor.sol";


contract Delegator is ExecutorStorage, DelegateScriptTarget {
    function exec() public returns (bool) {
        randomNumber += 1234;
    }

    function execReturnValue(uint i) public constant returns (uint) { return i; }
}


contract FailingDelegator is DelegateScriptTarget {
    function exec() public returns (bool) { revert(); }
}


contract DyingDelegator is DelegateScriptTarget {
    function exec() public returns (bool) { selfdestruct(0); }
}


contract FailingDeployment {
    function FailingDeployment() public { revert(); }
}


contract ProtectionModifierKernel is ExecutorStorage, DelegateScriptTarget {
    function exec() public returns (bool) {
        kernel = IKernel(0x1234);
    }
}


contract ProtectionModifierAppId is ExecutorStorage, DelegateScriptTarget {
    function exec() public returns (bool) {
        appId = bytes32(123456);
    }
}
