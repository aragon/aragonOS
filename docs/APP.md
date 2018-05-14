# App API Reference

## Contracts

- [AragonApp](#aragonapp)
  - [Modifiers](#modifiers)
    - [auth(bytes32 role)](#auth)
    - [authP(bytes32 role, uint256\[\] params)](#authp)
  - [Methods](#methods)
    - [canPerform(address sender, bytes32 role, uint256\[\] params)](#canperform-public-view)
    - [getRecoveryVault()](#getrecoveryvault-public-view)
    - [runScript(bytes script, bytes input, address\[\] blacklist) (*from EVMScriptRunner*)](#runscript-internal)
- [IForwarder](#iforwarder)
  - Methods
    - isForwarder()
    - canForward(address sender, bytes script)
    - forward(bytes)

## AragonApp

Contracts inheriting from this contract represent Aragon apps.

They are fully upgradeable through app proxies and governable through the ACL.

This contract provides helper methods for interacting with the ACL as well as running [EVM scripts](EVM_SCRIPTS.md).

### Importing

```solidity
import "@aragon/os/contracts/apps/AragonApp.sol";
```

### Modifiers

#### auth

Performs a check to see if `msg.sender` has a specific role in the ACL. It is used to guard methods.

Roles should always be a `keccak256` of the role name, and the contract *must* define a public constant under the same name.

Check the example for more information.

**Parameters**

1. `role` (`bytes32`): The role to check for.

**Example**

```solidity
contract App is AragonApp {
  // ...
  bytes32 constant public COOL_ROLE = keccak256("COOL_ROLE");

  function onlyCoolPeopleCanCallMe() auth(COOL_ROLE) external {
    // ...
  }
}
```

#### authP

> ℹ️ This is an advanced feature.

Performs a parameterized check to see if `msg.sender` has access to perform an action with a specific role under a set of specific conditions (as defined by the ACL), provided a set of parameters.

For example, it is possible to set up the ACL in a way such that a user can only invoke a method guarded by a role iff a certain block number has been reached.

To read more on ACL parameterization, check the [spec](aragonOS.md#44-parameter-interpretation).

**Parameters**

1. `role` (`bytes32`): The role to check for.
2. `params` (`uint256`): The parameters of the check.

**Example**

```solidity
contract App is AragonApp {
  // ...
  bytes32 constant public COOL_ROLE = keccak256("COOL_ROLE");

	// It is now possible to set up the ACL in such a way that not only
	// must an entity have the `COOL_ROLE`, but a certain block number
	// must also be reached. Night clubs on Ethereum? 🤔
  function onlyCoolPeopleCanCallMe() auth(COOL_ROLE, arr(block.number)) external {
    // ...
  }
}
```

### Methods

#### canPerform (*public view*)

Check if `sender` can invoke a method guarded by `role` under a set of conditions defined by `params`.

**Parameters**

1. `sender` (`address`): The entity to check permissions for
2. `role` (`bytes32`): The role to check for.
3. `params` (`uint256[]`): The parameters of the check.

**Return Values**

1. `authorized` (`bool`): Whether or not `sender` can is authorized by the ACL.

**Example**

```solidity
// A simple check with no parameters
canPerform(msg.sender, COOL_ROLE, arr());
```

#### getRecoveryVault (*public view*)

Get the address of the recovery vault.

The recovery vault is a smart contract you can send funds to in the case of an emergency or to recover lost funds.

**Parameters**

None.

**Return Values**

1. `vault` (`address`): The address of the recovery vault.

#### runScript (*internal*)

Runs an [EVM script](#).

Refer to the [EVM script](#) reference for more information about the different types of EVM scripts.

This method is used to execute transactions on behalf of other entities ([read more on forwarders](#)).

**Parameters**

1. `script` (`bytes`): The script to execute (see [EVM script reference](EVM_SCRIPTS.md) for format).
2. `input` (`bytes`): The input of the execution (see [EVM script reference](EVM_SCRIPTS.md) for required input).
3. `blacklist` (`address[]`): A blacklist of addresses for this execution (see [EVM script reference](EVM_SCRIPTS.md) for behaviour of blacklist).

**Return Values**

1. `output` (`bytes`): The output of the execution (see [EVM script reference](EVM_SCRIPTS.md) for the format of the output).

## IForwarder

Contracts implementing this interface are *forwarders*.

A forwarder is a smart contract that can excecute transactions on another entity's behalf. They are an integral part of transaction pathing (also called *permission escalation*).

To learn more about implementing a forwarder and why, check out [the guide](FORWARDER.md).

###Importing

```solidity
import "@aragon/os/contracts/common/IForwarder.sol";
```

### Methods

#### isForwarder (*public pure*)

This method should always return true as it is used as an interface detection mechanism in Aragon.js.

**Parameters**

None.

**Return Values**

1. `isForwarder` (`bool`): Should always return true. If the contract is not a forwarder, the call reverts.

#### canForward (*public view*)

This method should return true if the forwarder can forward the [EVM script](EVM_SCRIPTS.md) (`script`) on `sender`'s behalf, otherwise it should return false.

**Parameters**

1. `sender` (`address`): The entity that wants `script` forwarded
2. `script` (`bytes`): The [EVM script](EVM_SCRIPTS.md) `sender` wants executed on their behalf

**Return Values**

1. `canForward` (`bool`): Should return true if `script` can be executed for `sender`, otherwise false.

#### forward (*public*)

This method should **eventually** execute the [EVM script](EVM_SCRIPTS.md) `script` for `msg.sender`.

Note that there is no guarantee that `script` will be executed, as it is entirely up to the forwarder.

This method is used to implement governance mechanisms. For example, a voting app might store `script` in a vote, and if the vote passes, it executes it on `msg.sender`'s behalf.

**Parameters**

1. `script` (`bytes`): The [EVM script](EVM_SCRIPTS.md) that `msg.sender` wants executed.

**Return Values**

None.