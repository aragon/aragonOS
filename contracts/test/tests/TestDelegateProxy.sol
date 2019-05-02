pragma solidity 0.4.24;

import "../helpers/Assert.sol";
import "../helpers/ThrowProxy.sol";

import "../../common/DelegateProxy.sol";
import "../../evmscript/ScriptHelpers.sol";


contract Target {
    function dontReturn() public pure {}
    function fail() public pure { revert(); }
    function die() public { selfdestruct(0); }
}


contract TestDelegateProxy is DelegateProxy {
    using ScriptHelpers for *;

    Target target;
    ThrowProxy throwProxy;

    // Mock ERCProxy implementation
    function implementation() public view returns (address) {
        return this;
    }

    function proxyType() public pure returns (uint256) {
        return FORWARDING;
    }

    // Tests
    function beforeAll() public {
        target = new Target();
    }

    function beforeEach() public {
        throwProxy = new ThrowProxy(address(this));
    }

    function testFailIfNoContract() public {
        TestDelegateProxy(throwProxy).noContract();
        throwProxy.assertThrows("should have reverted if target is not a contract");
    }

    function noContract() public {
        delegatedFwd(address(0x1234), target.dontReturn.selector.toBytes());
    }

    function testFailIfReverts() public {
        TestDelegateProxy(throwProxy).revertCall();
        throwProxy.assertThrows("should have reverted if call reverted");
    }

    function revertCall() public {
        delegatedFwd(target, target.fail.selector.toBytes());
    }

    function testIsContractZero() public {
        bool result = isContract(address(0));
        Assert.isFalse(result, "should return false");
    }

    function testIsContractAddress() public {
        address nonContract = 0x1234;
        bool result = isContract(nonContract);
        Assert.isFalse(result, "should return false");
    }

    // keep as last test as it will kill this contract
    function testDieIfMinReturn0() public {
        Assert.isTrue(true, ''); // Make at least one assertion to satisfy the runner

        delegatedFwd(target, target.die.selector.toBytes());
        Assert.fail('should be dead');
    }
}
