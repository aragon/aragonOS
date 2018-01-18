pragma solidity 0.4.18;

import "../../contracts/evmscript/executors/DelegateScript.sol";
import "./Executor.sol";


contract Delegator is ExecutorStorage, DelegateScriptTarget {
    function exec() public {
        randomNumber += 1234;
    }

    function execReturnValue(uint i) public pure returns (uint) { return i; }
}

contract FailingDelegator is DelegateScriptTarget {
    function exec() public { revert(); }
}


contract FailingDeployment {
    function FailingDeployment() { revert(); }
}


contract ProtectionModifierKernel is ExecutorStorage, DelegateScriptTarget {
    function exec() public {
        kernel = IKernel(0x1234);
    }
}


contract ProtectionModifierAppId is ExecutorStorage, DelegateScriptTarget {
    function exec() public {
        appId = bytes32(123456);
    }
}
