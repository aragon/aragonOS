pragma solidity 0.4.24;

import "../helpers/Assert.sol";
import "../helpers/ThrowProxy.sol";

import "../../common/DelegateProxy.sol";
import "../../evmscript/ScriptHelpers.sol";


contract Target {
    function die() public { selfdestruct(0); }
}

contract TestDelegateProxySuicide is DelegateProxy {
    using ScriptHelpers for *;

    Target target;

    // Mock ERCProxy implementation
    function implementation() public view returns (address) {
        return this;
    }

    function proxyType() public pure returns (uint256) {
        return FORWARDING;
    }

    function beforeAll() public {
        target = new Target();
    }

    function testDieIfMinReturn0() public {
        Assert.isTrue(true, ''); // Make at least one assertion to satisfy the runner

        delegatedFwd(target, target.die.selector.toBytes());
        Assert.fail('should be dead');
    }
}
