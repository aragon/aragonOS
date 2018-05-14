# aragonOS App Guide

> ℹ️ **This guide is only for the smart contracts of an Aragon app**
>
> To see a full 0-100 guide on building an Aragon app, check out ["Your First Aragon App"](#).

In this guide we will walk through building a simple smart contract that is *upgradeable and governable* using aragonOS.

This guide assumes novice knowledge of Solidity.

## Setup

First, set up your Truffle project

```
mkdir aragon-app
cd aragon-app
npx truffle init
```

Next, install aragonOS

```
npm i @aragon/os
```

## Writing A Basic Smart Contract

To illustrate how simple it is to use aragonOS, we will write our app's smart contracts without using aragonOS, and then use aragonOS afterwards.

In this guide we will write a simple counter app -- we can increment and we can decrement the counter.

Let's write our tests first, and then implement our contract afterwards and ensure that they pass.

```js
const Counter = artifacts.require('./Counter.sol')

contract('Counter App', function(accounts) {
  it('should start with a value of 0', function () {
    return Counter.deployed()
      .then((instance) => {
        return instance.value()
      })
      .then((value) => {
        assert.equal(value.valueOf(), 0, `0 wasn't the starting value`)
      })
  })
  
  context('incrementing value', function () {
    it('emits an event', function () {
      return Counter.deployed()
        .then((instance) => {
          return instance.increment()
        })
        .then((receipt) => {
          const events = receipt.logs
            .filter((log) => log.event == 'Increment')
          assert.equal(events.length, 1, 'increment did not emit an event')
        })
    })
    it('increments the value', async function () {
      const instance = await Counter.deployed()
      return instance.increment()
        .then(() => {
          return instance.value()
        })
        .then((value) => {
          assert.equal(value.valueOf(), 2, `increment did not increment the value`)
        })
    })
  })

  context('decrementing value', function () {
    it('emits an event', function () {
      return Counter.deployed()
        .then((instance) => {
          return instance.decrement()
        })
        .then((receipt) => {
          const events = receipt.logs
            .filter((log) => log.event == 'Decrement')
          assert.equal(events.length, 1, 'decrement did not emit an event')
        })
    })
    it('decrements the value', async function () {
      const instance = await Counter.deployed()
      return instance.decrement()
        .then(() => {
          return instance.value()
        })
        .then((value) => {
          assert.equal(value.valueOf(), 0, `decrement did not decrement the value`)
        })
    })
  })
})
```

If you run `npx truffle test` you should see that all of the tests are failing.

Next, let us write our smart contract.

```solidity
pragma solidity ^0.4.4;

contract Counter {
    // Events
    event Increment(address entity);
    event Decrement(address entity);

    // State
    int public value;

    /**
     * @notice Increment the counter by 1
     */
    function increment() external {
        value += 1;
        Increment(msg.sender);
    }

    /**
     * @notice Decrement the counter by 1
     */
    function decrement() external {
        value -= 1;
        Decrement(msg.sender);
    }
}
```

Cool! If you run `npx truffle test` again, you should see that all tests are now passing.

## Adding Upgradeability And Governance

Adding aragonOS on top of our smart contract is easy. In fact, it only requires 3 steps:

1. Inherit the [AragonApp contract](APP.md#aragonapp)
2. Define our app's roles
3. Add the [`auth`](APP.md#auth) modifier to our methods

Let's do that now.

```solidity
pragma solidity ^0.4.4;

// 1. Inherit AragonApp
import "@aragon/os/contracts/apps/AragonApp.sol";
contract Counter is AragonApp {
    // Events
    event Increment(address entity);
    event Decrement(address entity);

    // State
    int public value;

    // 2. Define roles
    bytes32 constant public INCREMENT_ROLE = keccak256("INCREMENT_ROLE");
    bytes32 constant public DECREMENT_ROLE = keccak256("DECREMENT_ROLE");
    
    // 3. Use the `auth` modifier
    /**
     * @notice Increment the counter by 1
     */
    function increment() auth(INCREMENT_ROLE) external {
        value += 1;
        Increment(msg.sender);
    }

    /**
     * @notice Decrement the counter by 1
     */
    function decrement() auth(DECREMENT_ROLE) external {
        value -= 1;
        Decrement(msg.sender);
    }
}
```

If you run `npx truffle test` yet again, you should see that all tests are still passing.

So, what happens here? Inheriting [`AragonApp`](APP.md#aragonapp) gives us a few helper functions and modifiers, most notably the [`auth`](APP.md#auth) modifier.

The `auth` modifier calls the ACL (access control list) and asks if `msg.sender` has a specific role assigned. In our case, the roles are either `INCREMENT_ROLE` or `DECREMENT_ROLE`.

The role must be a `keccak256` of the full role name, and a public constant must be available under the same name for discovery purposes.

As a side note, the `auth` modifier will always return true when run in a test environment, making it just as easy to test your smart contracts as before.

Okay, so now we have governance, but what makes our app upgradeable?

The smart contract we just wrote is the *app logic*. *App instances* on the other hand are [ERC897 proxies](https://github.com/ethereum/EIPs/pull/897) that point to your app logic. As such, aragonOS supports multiple instances of your app per DAO.

The proxy references the kernel and asks the kernel where your app logic is. This means that we can replace the address of the app logic in the kernel if we wish to, which makes it upgradeable.

Of course, this action is also guarded by the ACL.