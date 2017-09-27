# Token Manager
 
Token Manager is a wrapper over the concept of the MiniMeToken controller. Its most important features are minting new tokens and locking token transferability over time (vesting).

One Token Manager instance can manage one MiniMe token.

### Modes

Token Manager can handle two modes or use-cases. The mode is set on initialization and cannot be changed.

- Native token mode: The managed token can be minted arbitrarily. 
- Wrapped token mode: The managed token acts as a wrapper to another ERC20 token. The managed token can only be minted by staking (wrapping) units of the wrapped token. At any time a holder of the wrapper token can exchange it back for the original token (unless there is vesting).


### Initialization

There are two different initializers depending on the mode.

- Token: The token being managed. The Token Manager should have already been set as the `controller` for the token.
- Wrapped token: Address of the token that will be. `_wrapped`


### Mode specific functionality

##### Native mode

###### `mint(address receiver, uint256 amount)`

Creates new tokens and assigns them to the receiver.

###### `issue(uint256 amount)`

Creates new tokens that are assigned to the Token Manager. Those can be later assigned.

##### Wrapper mode

Wrapper mode works under the assumption that the wrapped token is a trusted ERC20 implementation, meaning transfers are performed normally (no fees on token transfers) and balances constant if no operations are made. 

###### `wrap(uint256 amount)`

Requires an existing ERC20 allowance to the Token Manager address for at least that amount of tokens. It will transfer the wrapped tokens to the Token Manager and mint an equal amount of wrapper tokens for the sender.

Will fail if sender hasn't created the allowance or doesn't have enough wrapped token balance.

###### `unwrap(uint256 amount)`

It will burn the wrapper tokens and transfer the user the same amount in wrapped tokens.

Will fail if sender doesn't own that many tokens.

### Generic functionality 

###### `assign(address receiver, uint256 amount)`

Transfers tokens from Token Manager balance to `receiver`. Token Manager can own tokens as a result of an `issue` operation on native mode or just because the Token Manager received a normal token transfer.

###### `assignVested(address receiver, uint256 amount, { Vesting settings })`

Performs an assign but attaches rules on when the receiver can transfer her tokens. 


### Vesting
