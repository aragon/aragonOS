pragma solidity 0.4.18;

import "truffle/Assert.sol";
import "./helpers/ThrowProxy.sol";

import "../contracts/common/DelegateProxy.sol";
import "../contracts/evmscript/ScriptHelpers.sol";


contract Target {
    function returnSomething() public constant returns (bool) { return true; }
    function dontReturn() public {}
    function fail() public { revert(); }
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

    function testMinReturn0WithoutReturn() public {
        delegatedFwd(target, target.dontReturn.selector.toBytes(), 0);
    }

    function testMinReturn0WithReturn() public {
        delegatedFwd(target, target.returnSomething.selector.toBytes(), 0);
    }

    function testMinReturn32WithReturn() public {
        delegatedFwd(target, target.returnSomething.selector.toBytes(), 32);
    }

    function testFailsIfReturnLessThanMin() public {
        TestDelegateProxy(throwProxy).revertIfReturnLessThanMin();
        throwProxy.assertThrows("should have reverted if return data was less than min");
    }

    function revertIfReturnLessThanMin() public {
        delegatedFwd(target, target.dontReturn.selector.toBytes(), 32);
    }

    function testFailIfNoContract() public {
        TestDelegateProxy(throwProxy).noContract();
        throwProxy.assertThrows("should have reverted if target is not a contract");
    }

    function noContract() public {
        delegatedFwd(address(0x1234), target.dontReturn.selector.toBytes(), 0);
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

    /* TODO: this test doesn't work with ganache. To be restablished when we use geth for tests
    function testSelfdestructIsRevertedWithMinReturn() public {
        TestDelegateProxy(throwProxy).revertIfReturnLessThanMinAndDie();
        throwProxy.assertThrows("should have reverted to stop selfdestruct");
    }

    function revertIfReturnLessThanMinAndDie() public {
        delegatedFwd(target, target.die.selector.toBytes(), 32);
    }
    */

    // keep as last test as it will kill this contract
    function testDieIfMinReturn0() public {
        delegatedFwd(target, target.die.selector.toBytes());
    }
}
