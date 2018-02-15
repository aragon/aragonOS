# aragonOS 3.0 alpha, developer documentation

*Documentation for [aragonOS](https://github.com/aragon/aragonOS) 3.0 reference implementation.
Updated Feb. 15th, 2018. (aragonOS v3.0.2 release)*

This document provides a technical overview about the architecture and can be used
as a specification and developer guide. For a less technically-oriented introduction
to aragonOS 3.0, you can check the [alpha release blog post]().

## 0. Motivation

aragonOS was born in our path to developing modular and upgradeable smart contracts
to power decentralized organizations.

As the project was maturing and we started abstracting more and more, we ended up
with a pretty generic framework that can be used by any protocol or decentralized
application that needs upgradeability.

**Upgradeability** is really important when developing high-stakes systems in
platforms that are still evolving fast. Done well, it can allow for bug fixes
and improvements with very little disruption and not causing problems at the
protocol level. As a history lesson, if *The DAO* had had an effective
upgradeability mechanism, no hard fork would have been required to fix the problem.
which caused the community months of unproductive discussions, delays in the roadmap
and billions lost in the market capitalization of the protocol due to loss of
network effect because of the fork.

But upgradeability is a double edged sword. It doesn't matter how secure or trustless
a smart contract is, if it can be upgraded, the contract will effectively be whatever
who/what can upgrade the contract decides. The guarantees of an upgradeable smart
contract are only as strong as the **governance mechanism** that can upgrade it,
making governance the most important aspect of upgradeability.

In a similar way, you cannot have effective governance without a way for upgrading
itself to a superior form of governance. Therefore we feel very strongly that
**upgradeability** and **governance**, in the context of smart contract, are actually
**two sides of the same coin**.

At Aragon we are doing a lot of research in decentralized governance and the
results of our research will be made aragonOS compatible, meaning that by using
aragonOS, any protocol can take advantage of our extensive research on governance
for upgradeability or any other aspect of the protocol or application.

## 1. General architecture, Kernel and apps

## 2. Kernel
### 2.1 The app mapping
### 2.2 Namespaces
### 2.3 The apps of a DAO

## 3. Upgradeability
### 3.1 DelegateProxies
### 3.2 Kernel upgradeability
### 3.3 AppProxies and upgradeability

## 4. ACL
### 4.1 The ACL as an Aragon app, the Interface
### 4.2 Basic ACL

- any entity!

### 4.3 Permission managers
### 4.4 Parameter interpretation
When a permission is granted to an entity by the permission manager, it can be
assigned an array of parameters that will be evaluated every time the ACL is checked
to see if the entity can perform the action.

Parameters allow to perform certain computations with the arguments of a role in
order to decide whether the action can be done or not. This moves the ACL for being
a purely binary access list, to a more sophisticated system that allows way more
granular control.

An ACL parameter is comprised of a data structure with 3 values:

- **Argument Value** (`uint240`): It is the value to compare against depending on
the argument. It is a regular Ethereum memory word, that looses it 2 most significant
bytes of precision. The reason for this was to allow parameters to be saved in just
one storage slot, saving significant gas.
Even though `uint240`s are used, it can be used to store any integer up to `2^30 - 1`,
addresses and bytes32 (in the case of comparing hashes, losing 2 bytes of precision
shouldn't be a dealbreaker if the hash algorithm is secure). The only problem is
when
- **Argument ID** (`uint8`): Determines how the comparison value is fetched. From
0 to 200 it refers to the argument index number passed to the role. After 200, there
are some *special Argument IDs*:
    - `BLOCK_NUMBER_PARAM_ID` (`id = 200`): Sets comparison value to the block number
    at the time of execution. This allows for setting up timelocks depending
    on blocks.
    - `TIMESTAMP_PARAM_ID` (`id = 201`): Sets comparison value to the timestamp of the
    current block at the time of execution. This allows for setting up timelocks
    on time.
    - `SENDER_PARAM_ID` (`id = 202`): Sets comparison value to the sender of the call.
    (Currently useless because of [this issue]())
    - `ORACLE_PARAM_ID` (`id = 203`): Checks with an oracle at the address in the
    *argument value* and returns whether it returned true or false (no comparison with arg).
    - `LOGIC_OP_PARAM_ID` (`id = 204`): Evaluates a logical operation and returns
    true or false depending on its result (no comparison with arg).
    - `PARAM_VALUE_PARAM_ID` (`id = 205`): Uses value as return. Commonly used with
    the `RET` operation, to just return a value. If the value in the param is greater
    than 0, it will evaluate to true, otherwise it will return false.
- **Operation type** (`uint8`): Determines what operation is made to compare the
value fetched using the argument ID or the argument value. For all comparisons,
both values are compared in the following order `args[param.id] <param.op> param.value`.
Therefore for a greater than operation, with a `param = {id: 0, op: Op.GT, value: 10}`,
it will interpret whether the argument 0 is greater than 10. The implemented
operation types are:
    - None (`Op.NONE`): Always evaluates to `false`, regardless of parameter or arguments.
    - Equals (`Op.EQ`): Evaluates to true if every byte matches between `args[param.id]` and
    `param.value`.
    - Not equals (`Op.NEQ`): Evaluates to true if any byte doesn't match.
    - Greater than (`Op.GT`): Evaluates to true if `args[param.id] > param.value`.
    - Less than (`Op.LT`): Evaluates to true if `args[param.id] < param.value`.
    - Greater than or equal (`Op.GTE`): Evaluates to true if `args[param.id] >= param.value`.
    - Less than or equal (`Op.LTE`): Evaluates to true if `args[param.id] <= param.value`.
    - Return (`Op.RET`): Evaluates to true if `args[param.id]` is greater than one.
    Used with `PARAM_VALUE_PARAM_ID`, it makes `args[param.id] = param.value`, so it
    returns the parameter associated value.

While also representing an operation, when the id is `LOGIC_OP_PARAM_ID`, only the
ops below are valid. These operations use the parameter's value to point to other
parameters index in the parameter array. These values are encoded as `uint32`
numbers, left-shifted 32 bits to the left each (example: for example, an op that
takes two inputs value would be `0x00....0000000200000001`, would be input 1, 1,
and input 2, 2, refering to params at index 1 and 2). Available logic ops:
    - Not (`Op.NOT`): Takes 1 parameter index and evaluates to the opposite of what
    the linked parameter evaluates to.
    - And (`Op.AND`): Takes 2 parameter indices and evaluates to true if both
    evaluate to true.
    - Or (`Op.OR`): Takes 2 parameter indices and evaluates to true if any of them
    evaluate to true.
    - Exclusive or (`Op.XOR`): Takes 2 parameter indices and evaluates to true if
    only one of the parameters evaluate to true.
    - If else (`Op.IF_ELSE`): Takes 3 parameters, evaluates the first parameter
    and if it evaluates to true, it evaluates to whatever the parameter second
    parameter evaluates to, otherwise it evaluates to whatever the third parameter
    does.

### 4.6 Parameter execution
When evaluating a rule, the ACL will always evaluate the result of the first parameter.
This first parameter can be an operation that links to other parameters and its
evaluation depends on those parameter evaluation.

Execution is recursive and the result evaluated is always the result of the eval
of the first parameter.

### 4.7 Parameter encoding
### 4.8 Examples of rules

## 5. Forwarders and EVMScript
### 5.1 Forwarding and transaction pathing
### 5.2 EVMScripts
#### 5.2.1 Warnings
#### 5.2.2 Script executors
##### 5.2.2.1 CallScript
##### 5.2.2.1 DelegateScript
##### 5.2.2.3 DeployDelegateScript

## 6. The Aragon Package Manager
### 6.1 APM as an Aragon DAO
The Aragon Package Manager (APM) is built on top of aragonOS and is integrated as a
part of aragonOS. It is a DAO running on the same Aragon (taking advantage of
upgradeability and access control), that‘s used to build Aragon DAOs!

This allows for many APM registries to exist with different governance models for
package publishing and releasing new versions. There is an official Aragon curated one,
aragonpm.eth, which has very strict restrictions of what gets published and
very high quality standards, that we use for publishing our core components.

Different APM registries in which everyone can publish their packages are expected to
be created by the community.

This diagram tries to illustrate the architecture of an APM Registry DAO:

![](rsc/apm-arch.jpeg)

### 6.2 APMRegistry
#### 6.2.1 ENSSubdomainRegistrar
#### 6.2.2 APMRegistry governance
### 6.3 Repos

After discovering an entity in the DAO by traversing the ACL that is an app (see
section 2.3 *The apps of a DAO*), we can fetch its `app.appId()` and use ENS to
resolve its Repo contract:

```
repo = Repo(Resolver(ens.resolver(appId)).addr(appId))
```
or using ens.js:
```
repo = Repo.at(await ens.addr(appId))
```

Every individual Repo is an Aragon app that uses the APM DAO for its ACL.
Depending on each APM registry governance, the process for creating new versions
in the Repo or transferring ownership may vary.

A Repo keeps versioned state over:

  - **Smart contract library code** (`contractAddress`): the app code is the address of
  the deployed version of the app. The Kernel determines which version of the app
  it uses by pointing to the app code address associated with that version.
  - **Package content** (`contentURI`): defined by a location ID of where the other
  components of the package (e.g. frontend) are hosted (IPFS, Swarm, etc.) and
  the content hash for fetching it. Inside this package an `arapp.json` file is
  expected to be found.

A Repo can be created that only versions one of the two. It is fine to use it that
way but all the rules below still apply.

By versioning both the app code address and the package content, we can add
additional expectations for the what semantic versioning of Repos mean:

  - **Patch**: Minor changes to the package contents (e.g. frontend). Update can
  be performed silently for users.
  - **Minor**: Major changes to the package contents, but still works with the
  current smart contract code. Users should be notified of the update.
  - **Major**: Any change to the smart contract app code with or without an
  accompanying frontend upgrade. User interaction is needed to upgrade.

#### 6.3.1 Version upgrade rules
Before creating a new version in a repo, an ACL check is performed to see whether
the entity has permission to create a new version.

After the ACL check, the Repo logic checks whether the version upgrade is allowed.
A version bump for a package is defined by the following rules:

- Only one member of the version is increased by 1. The version components to the
left of the raised member must stay the same and the components to the right must be 0.
  - Example: From `2.1.3` the only allowed bumps are to `3.0.0` (major version),
  `2.2.0` (minor version), and `2.1.4` (patch version).
- Changes to the app code address can only be done if the raise changes the major
version (upgrading it to `M.0.0` by the above rule).

The initial version of an app must be a valid bump from version `0.0.0`.

By having this check performed at the smart contract level, we can load the correct
version of the frontend just by looking at an instance of an app. This is done by
checking that the version of a smart contract is linked to a given app by getting
its `appId` and `appCode` (See section *6.3.2.3 By latest contract address*)

#### 6.3.2 Fetching Repo versions
Repos offer multiple ways to fetch versions. By checking logs for the following
event one can see all the versions ever created in a Repo:

```
(Repo) NewVersion(uint256 versionId, uint16[3] semanticVersion);
```

All different methods for fetching versions return the following tuple:

```
repoVersion = (uint16[3] semanticVersion, address contractAddress, bytes contentURI)
```

#### 6.3.2.1 By versionId
Every version can be fetched with its `versionId` (which starts in `1` and is
increments by `1` each version).

```
repoVersion = repo.getByVersionId(versionId)
```

The total count of versions created in a Repo can be queried with:
```
count = repo.getVersionsCount()
lastVersionId = count - 1
```

#### 6.3.2.2 By semantic version
Providing the exact semantic version.
```
repoVersion = repo.getBySemanticVersion([major, minor, patch])
```

#### 6.3.2.3 By latest contract address
Fetching the latest version by contract address allows clients to get the latest
frontend package for an organization that may have not upgraded the smart contract
code to the latest version.
```
repoVersion = repo.getLatestForContractAddress(contractCode)
```

#### 6.3.2.4 Latest version
Pretty self-describing.
```
repoVersion = repo.getLatest()
```

## 7. Aragon app development guide
### 7.1 Using the ACL
### 7.2 Upgradeability: storage considerations
### 7.3 Testing and publishing your app with aragon-dev-cli
