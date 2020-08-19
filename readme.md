<p align="center"><img width="50%" src=".github/assets/aragonos.svg"></p>

<div align="center">
  <!-- NPM -->
  <a href="https://npmjs.org/package/@aragon/os">
    <img src="https://img.shields.io/npm/v/@aragon/os.svg?style=flat-square" alt="Version" />
  </a>
  <!-- Security -->
  <a href="SECURITY.md">
    <img src="https://img.shields.io/badge/security-audited-green?style=flat-square" alt="Security" />
  </a>
  <!-- Coverage -->
  <a href="https://coveralls.io/github/aragon/aragonOS?branch=master">
    <img src="https://img.shields.io/coveralls/aragon/aragonOS/master.svg?style=flat-square" alt="Coverage" />
  </a>
</div>

<div align="center">
  <h4>
    <a href="https://aragon.org">
      Website
    </a>
    <span> | </span>
    <a href="https://hack.aragon.org/docs/aragonos-intro.html">
      Documentation
    </a>
    <span> | </span>
    <a href="https://github.com/aragon/aragonOS/releases">
      Releases
    </a>
    <span> | </span>
    <a href="CONTRIBUTING.md">
      Contributing
    </a>
    <span> | </span>
    <a href="https://spectrum.chat/aragon/aragonos">
      Support &amp; Chat
    </a>
  </h4>
</div>

# aragonOS

A smart contract framework for building decentralized organizations.

#### 🚨 Security review status: bug bounty

aragonOS has passed a number of [independent professional security audits](https://wiki.aragon.org/association/security/) with an ongoing $250,000 USD bug bounty program.

See [SECURITY.md](SECURITY.md) for more security-related information.

#### 🛰 Deployment status: available on Ethereum mainnet

aragonOS powers over a thousand organizations on Ethereum mainnet and secures over $20MM in funds.

Deployment logs for Ethereum mainnet and other networks are available in our [deployment
repo](https://github.com/aragon/deployments).

## Documentation

Visit the [Aragon Developer Portal](https://hack.aragon.org/docs/aragonos-intro.html) for in-depth documentation.

The [reference documentation](https://hack.aragon.org/docs/aragonos-ref.html) explains the various smart contract components and how to use them.

## Development

```sh
yarn install
yarn test

# Lint needs to pass as well
yarn run lint
```