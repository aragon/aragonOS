# Aragon Core <img align="right" src="https://github.com/aragonone/issues/blob/master/logo.png" height="80px" /> [![Build Status](https://travis-ci.org/aragon/aragon-core.svg?branch=master)](https://travis-ci.org/aragon/aragon-core) [![Coverage Status](https://coveralls.io/repos/github/aragon/aragon-core/badge.svg?branch=master)](https://coveralls.io/github/aragon/aragon-core?branch=master)

#### 🚨 Everything in this repo is highly experimental software.
It is not secure to use any of this code in production (mainnet) until proper security audits have been conducted. It can result in irreversible loss of funds.

#### 🦋 We are using [CommitETH](http://commiteth.com) to reward open source contributions outside the Aragon Core team.
All issues tagged with **[bounty](https://github.com/aragon/aragon-core/labels/bounty)** are eligible for a bounty on a succesfully merged Pull Request that solves the issue. Even if the bounty says 0 ETH, if it has the **bounty** label, it is higher than 0 ETH (until we automate it, we may take a bit to fund the bounties manually).

Open source is awesome, but it is also hard work that needs to be rewarded to ensure top quality work, and that everyone in the world gets a fair chance to do it.

#### 👋 We are tagging tasks that are [beginner friendly](https://github.com/aragon/aragon-core/labels/beginner-friendly) so you can get started contributing to Aragon Core.
Don't be shy to contribute even the smallest tweak. Everyone will be specially nice and helpful to beginners to help you get started!

## Documentation

Visit the [wiki](https://github.com/aragon/aragon-core/wiki) for in depth documentation on the [architecture](https://github.com/aragon/aragon-core/wiki/Architecture) and different parts of the system.

## Contributing

To make it easier for contributors to get up to speed, we provide a docker environment that provides all the requirements to build and test Aragon Core.

For more detail you can check the [contributing guide](https://github.com/aragon/aragon-core/wiki/How-to-contribute) on the wiki.

### Requirements

 - [Docker](https://www.docker.com/get-docker)
 - [Docker Compose](https://docs.docker.com/compose/install/)

### Run tests

    $ docker-compose run core test
