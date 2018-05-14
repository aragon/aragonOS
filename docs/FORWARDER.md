# Writing A Forwarder (Governance Mechanism)

> ℹ️ **This guide is only for the smart contracts of an Aragon app**
>
> To see a full 0-100 guide on building an Aragon app, check out ["Your First Aragon App"](#).

In this guide we will walk through building a smart contract that implements a governance mechanism.

This guide assumes novice knowledge of Solidity, and also that you have a basic understanding of how to build Aragon apps. To learn more about building Aragon apps, [check out this guide](APP_GUIDE.md).

## What Is A Forwarder?

A forwarder is a smart contract that can *execute transaction on another entity's behalf* using [EVM scripts](EVM_SCRIPTS.md) given certain (self-defined) conditions.

Forwarders are a core building block of the aragonOS architecture, as they are the piece used to implement governance mechanisms. Think of them like small building blocks that do one thing, and when combined, they can encode complex governance mechanisms.

For example, a voting app might be a forwarder, where passing votes execute an EVM script upon passing. If we combine this with a staking app that is also a forwarder, we have staked voting.

The beauty of the design of forwarders is that there is no need to make assumptions about what is executed before or after the forwarder, allowing for coupling forwarders together at run time and building complex structures from simple blocks.

The way forwarders interact with each other, and how other entities interact with forwarders, is defined by the ACL.

### The ACL

The ACL (access control list) is a simple registry of `who` can do `what` and `where`.

For example, Carlos (`who`) might be able to invoke any method on a smart contract (`where`) with the `COOL_ROLE` (`what`).

However, let's say that Carlos wants to transfer funds out of the Vault app. He might not have permission to do so, but he has permission to create a vote, and the voting app has permission to transfer funds.

In this instance, we can deduce that in order for Carlos to transfer funds out of the vault, he has to create a vote and tell it to execute the transfer method on his behalf.

This is what we call *transaction pathing* (also called *permission escalation*).

### Transaction Pathing

Put in simple terms, *transaction pathing* is figuring out how to execute a given action, as defined by the ACL. This calculation is done client-side, as opposed to on-chain.

In the above example from the previous section, we calculated that Carlos can only transfer funds out of the vault if he creates a vote.

When doing transaction pathing, we only account for the sender's (in this instance Carlos) permissions, and all forwarders' permissions. As such, depending on how you set permissions in the ACL, different paths will be produced.

During transaction pathing, we ask every forwarder that has access to perform the specified action if they can execute a transaction on behalf of Carlos or any forwarder that Carlos has access to. The outcome can be either yes or no, but even if a forwarder *can* execute an action on Carlos' behalf, it does not mean that the action *will* be executed on his behalf.

This is due to the fact that the conditions under which the action is executed are specified by logic in the forwarder.

We provide a library called Aragon.js that does transaction pathing for your app frontends.

## Building A Forwarder

So, knowing a bit about how forwarders work, we could build our own.

We're simply turning the app from the [previous guide](APP_GUIDE.md) in to a forwarder.

For our specification, we will say that this forwarder will forward *any* action given that the counter is at a certain threshold (in our example 10).

We simply implement the [IForwarder](APP.md#iforwarder) interface and implement three methods:

```solidity
pragma solidity ^0.4.4;

import "@aragon/os/contracts/apps/AragonApp.sol";
// 1. Inherit the IForwarder interface
import "@aragon/os/contracts/common/IForwarder.sol";
contract Counter is AragonApp, IForwarder {
    // Events
    event Increment(address entity);
    event Decrement(address entity);

    // State
    int public value;

    // Roles
    bytes32 constant public INCREMENT_ROLE = keccak256("INCREMENT_ROLE");
    bytes32 constant public DECREMENT_ROLE = keccak256("DECREMENT_ROLE");
    
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
    
    // 2. Define the three methods
    function isForwarder() public pure returns (bool) {
        return true;
    }
    
    function canForward(address _sender, bytes _evmCallScript) public view returns (bool) {
        return value >= 10;
    }
    
    function forward(bytes _evmScript) public {
        require(canForward(msg.sender, _evmScript));
        
        // Reset the value
        value = 0;
        
        // Execute the action
        bytes memory input = new bytes(0);
        runScript(_evmScript, input, new address[](0));
    }
}
```

