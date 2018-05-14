# EVM Scripts Reference

aragonOS uses a set of custom domain-specific language that are generally called *EVM Scripts*.

An EVM script encodes one or more complex actions that can be chained together, stored and later executed by one or more apps.

EVM scripts are an important concept of aragonOS, since they are used in permission escalation.

In aragonOS 3.0, there are three different types of EVM scripts.

## Anatomy Of An EVM Script

Since EVM scripts are of different types, each EVM script starts out with a 4 byte script identifier.

The length of the script body depends on the specific script type.

## EVM Scripts

### CallScript

Call scripts are a simple way to encode multiple transactions into one blob of bytes.

It is possible to execute multiple transactions at once using call scripts, but they are generally used to encode a chain of actions, such as permission escalation through multiple forwarders.

Call scripts revert if any of the calls fail during execution.

- **ID:** 0x00000001
- **Body:** Destination address (20 bytes), call data length (uint32, 4 bytes) and *n* bytes call data
- **Input:** None
- **Output:** None

### DelegateScript

> :warning: This feature is discouraged for now.

Executes a `delegatecall` into a given contract. This allows for any arbitrary execution within the executing contracts context.

- **ID:** 0x00000002
- **Body:** Destination address (20 bytes)
- **Input:** The call data for the `delegatecall`
- **Output:** The return data of the `delegatecall`

### DeployDelegateScript

> :warning: This feature is discouraged for now.