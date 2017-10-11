# Finance

The purpose of the Finance app is to be the central point for keeping track of income and expenses in an organization, as well as performing payments. 

The Finance app is multi-token (plus ether). In order to remove the need of a trusted prices feed (oracle) for token exchange rate, every token is accounted on its own for budgeting and period financial statements. 

### Core concepts

#### Accounting period

Accounting periods are the equivalent of financial quarters in traditional organizations. Their length can be set depending on how the organization wants to use them.

For every accounting period, a balance (called token statement) for every transacted token is kept, this balance will be negative if more was spent than deposited and positive if otherwise. 

#### Transactions

A transaction records an event in which assets were deposited or spent through the Finance app. Spend transactions are called 'outgoing transactions' and deposits 'incoming transactions'. Every transaction occurs in an accounting period and counts towards its token statement.

Transactions cannot be created directly, they are recorded as the result of an operation (either a payment being executed or a deposit made).

#### Payments

Payments are the construct used for spending using the Finance app. A payment can be created to happen only once or it can be a recurring payment that will be performed according to a certain schedule.

If executing a payment succeeds, it creates an outgoing transaction with a reference to the payment.

#### Budgeting 

Budgeting is the ability to limit how much units of a token can be spent per Accounting period. Budgets are set in a token per token basis. By default no token has a budget, which means unlimited spending can happen.

Once a budget has been set for a token, the Finance app will only allow the budgeted amount of tokens to be spent for that period.

### Initialization

Initializing a Finance app requires the following parameters:

- **Vault:** a reference to a [Vault](./vault.md) instance that the Finance app will use for depositing and spending tokens. In order for it to work correctly, the Finance app must have permissions to transfer Vault's tokens.
- **Ether token**: address of the EtherToken instance used as ether.
- **Accounting period duration**: the initial duration for accounting periods. Can later be changed for future periods.

### Deposits

Two deposit mechanisms are supported:

###### ERC20 `approve(...)` + `deposit(address token, uint256 amount, string reference)`

After doing an ERC20 approval with the Finance app as spender, calling `deposit(...)` will create an incoming transaction saving the reference string.

###### ERC677 `transferAndCall(...)`

Performing a ERC677 `transferAndCall(...)` to the Finance app will also trigger a deposit (intercepted with the `tokenFallback`). The data passed as payload to transferAndCall is used directly as the reference for the deposit. 

Given that aragon-core's EtherToken implementation conforms to ERC677, depositing Ether to the Finance app can be done by wrapping the ether using `etherToken.wrap()` and then doing a `transferAndCall(...)` or using the shortcut `wrapAndCall(...)` which performs both actions.

Please note that this section is subject to change as the [ERC677 discussion](https://github.com/ethereum/EIPs/issues/677) evolves.

### Period transitions

All operations that can result in the creation of a transaction (creating a payment, executing a payment, performing a deposit) first check whether the accounting period needs to be transitioned (previous period has end time has passed) or it can be triggered manually by calling `tryTransitionAccountingPeriod(...)`.

If many periods passed (last operation occurred two periods ago, but never transitioned), an empty period is created for every one of them.

To prevent the case in which the Finance app cannot perform any operation because it needs to transition too many accounting periods, causing any operation to go out of gas, transitioning periods has a parameter for how many periods it will transition. Automatic transitions will only perform 10 transitions maximum, and if more were needed the operation will fail. In case this lock occurs and periods cannot be automatically transitioned, multiple period transitions operations can be triggered manually to remove the lockup.


### Payments

Depending on the parameters a payment is created with, it can be an instant one time payment, a recurrent payment for payroll or a scheduled payment.

#### Payment parameters

- **Token**: Address of token for payment.
- **Receiver**: Address that will receive payment.
- **Amount**: units of token that are payed every time the payment is due.
- **Initial payment time**: timestamp for when the first payment is done.
- **Interval**: number of seconds that need to pass between payment transactions.
- **Maximum repeats**: maximum instances a payment can be executed. 

In case a payment can already be executed on creation, it will be executed. 

If a payment is created that won't be repeated ever again, and already was executed, only an outgoing transaction is recorded to save storage.


#### Payment execution

Payment execution will transfer the recipient of a payment the amount due depending on the current time. A single execution can result in multiple transactions if the payment hasn't been executed in time. To prevent it going out of gas when many transfers are due, a maximum amount of transfers are performed per execution (multiple executions could be needed in some instances).

Payments can always be executed by its recipient, but there is also an additional role to the Finance app that allows another entity to execute the payment (recipient gets the funds in both instances).

For payments whose token is the known EtherToken, instead of doing a token transfer, it will directly transfer ether to the recipient.

A payment execution can fail in case the organization is out of budget for the payment token for that particular accounting period, or the organization doesn't have enough token balance.

#### Disabling payments

At any time, a payment can be disabled by an authorized entity. If a payment hasn't been fully executed until that time and it is disabled, the recipient won't be able to execute it until it is enabled again.

### Limitations

- Payments are allowed to be created but can make it go out of budget. It can cause a race to execute payments right at the beginning of an Accounting period.
- Payment executions do not expire. There is an attack vector in which by not executing a payment in some time, a budget can be impacted when executed. In case this is happening, payment can be executed by another allowed entity or it could be disabled.