# Fundraising

The Fundraising app allows to sell an organization token in return for other tokens. It is a simple capped sale type that allows a certain flexibility through parametrization.

More complex sale types can be implemented as 3rd party applications.

### Dependencies and permissions

- `Token Manager`: On initialization it requires a reference to a `Token Manager` instance. One fundraising app instance is only able to 'sell' the underlying token managed by its `Token Manager`. **The fundraising app must be granted permissions to mint tokens on the Token Manager**.

- `Vault`: A reference to a `vault` is also required on initialization. However, there is no direct interaction with the vault, it is just used as the address where sale proceeds are deposited (vanilla ERC20 transfers).

Both parameters are not modifiable after initialization.

### Core concepts

- **Inverse pricing**: Given that there is no native support for floating point numbers in Solidity (EVM limitation), we need introduce the concept of inverse pricing to allow for prices that are below 1. Token decimals must be taken into account when setting pricing.
	- When inverse pricing is `false` in a sale, price means how many input tokens must be payed for each token being bought. That means the amount of tokens bought is calculated as `boughtTokens = payedTokens / price`. 
	- When inverse pricing is `true`, price means how many bought tokens are acquired per input token. `boughtTokens = payedTokens * price`

- **Price periods**:
	- A sale will go through one or multiple periods during its lifecycle.
	- Periods determine what the price is at any given moment during the sale.
	- A period starts at the same timestamp when the previous period ended (or in the case of the first one, when the sale starts).
	- A period has an initial and final price. If they are not the same, price for a given timestamp is linearly interpolated in function of time.
	- Sales can have up to 50 periods.

![](./rsc/fundraising_periods.png)

- **Caps**: By default all sales are capped on two aspects, uncapping a sale can be done by setting it to a very large number. Setting one or both caps to UINT256_MAX should be interpreted by the client as being uncapped on that aspect.
	- **Max raised**: Maximum amount of the token being raised that one sale accepts.
	- **Max sold**: Maximum amount of tokens a sale can sell (max tokens minted).

### Sale lifecycle

#### Initialization

All sale parameters are set on initialization and cannot be changed. After a sale has been created, there is the option to force closing the sale (requires permissions).

Sale parameters:

- Investor: Address of the entity allowed to buy in the sale. If the provided address is the 0th address (`0x0000...`), then the sale is considered public and any address can buy.
- Raised token: Address of the token used for buy in the sale. 
- Maximum raised: As explained in caps section.
- Maximum sold: As explained in caps section. 
- Minimum buy: Minimum amount of raised token for a valid purchase.
- Is inverse price: Whether sale prices are expressed as inverse or not (as explained above).
- Sale start time: Timestamp for the start of the first period.
- Period ends array: Array of timestamps when each period ends (Minimum 1).
- Prices array: Array of prices for periods. Even though each period has two values, it is a one dimensional array. Example: `[2, 3, 3, 5]` means Period 1(`initial price` = 2, `final price` = 3) and Period 2 (`initial price` = 3, `final price` = 5)

#### Buy entrypoints

Two methods are allowed for buying in sales:

###### ERC20: `transferAndBuy(uint256 saleId, uint256 payedTokens)`
Requires the sender to have already created an ERC20 allowance equal or greater than `payedTokens` (could actually be less in the scenario some tokens are not allowed for cap reasons).

###### ERC677: `buyTokens(uint256 saleId)`
Requires the sender to make a `transferAndCall()` as in the ERC677 standard, setting the fundraising app as receiver and adding the correct data payload.

#### Buy

On every buy, the contract will calculate the price for that time based on the sale periods.

- If a given buy results in the sale capping (either maxRaised or maxSold), the contract will refund the buyer the amount contributed over the cap and the sale is closed.

- After every individual buy, all funds are sent to the vault. The fundraising contract should never have funds in between buys.

#### Closing sale

The sale is automatically closed either when a cap is reached or when the last period of the sale is over.

Attempting to buy in a closed sale will fail.


### Limitations

- There is no concept of non-successful sale for lack of funding, therefore there are no refunds.
- In private sales, only one investor can buy. Whitelist sales are not supported.