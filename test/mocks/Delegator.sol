pragma solidity 0.4.18;

import "../../contracts/evmscript/specs/DelegateScript.sol";
import "./Executor.sol";

contract Delegator is ExecutorStorage, DelegateScriptTarget {
    function exec() public {
        randomNumber = 1234;
    }
}

contract FailingDelegator is DelegateScriptTarget {
    function exec() public { revert(); }
}

contract FailingDeployment {
    function FailingDeployment() { revert(); }
}
