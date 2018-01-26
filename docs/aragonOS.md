# aragonOS 3.0 alpha, developer documentation

*Documentation for [aragonOS](https://github.com/aragon/aragonOS) 3.0.0 reference implementation.
Updated Jan. 25th, 2018.*

This document provides a technical overview about the architecture. For a less
technically-oriented introduction to aragonOS 3.0, you can check the [alpha release blog post]().

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
### 4.3 Permission managers
### 4.4 Parameter interpretation
### 4.5 Examples of rules

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
