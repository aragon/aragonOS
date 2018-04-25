pragma solidity 0.4.18;

import "../../contracts/evmscript/executors/DelegateScript.sol";


contract DelegateScriptWrapper is DelegateScript {
    function isContractWrapper(address _target) public constant returns (bool) {
        return isContract(_target);
    }
}
