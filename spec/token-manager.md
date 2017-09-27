# Token Manager
 
Token Manager is a wrapper over the concept of the MiniMeToken controller. Its most important features are minting new tokens and locking token transferability over time (vesting).

One Token Manager instance can manage one MiniMe token.

### Modes

Token Manager can handle two modes or use-cases. The mode is set on initialization and cannot be changed.

- Native token mode: The managed token can be minted arbitrarily. 
- Wrapped token mode: The managed token acts as a wrapper to another ERC20 token. The managed token can only be minted by staking (wrapping) units of the wrapped token. At any time a holder of the wrapper token can exchange it back for the original token (unless there is vesting).


### Initialization

On initialization, two parameters are provided:

- Token: The token being managed. The Token Manager should have already been set as the `controller` for the token.
- Wrapped token: Address of the token that will be . Passin `_wrapped`