# Contributing to aragonOS

:tada: Thank you for being interested in contributing to aragonOS! :tada:

Feel welcome and read the following sections in order to know how to ask questions and how to work on something.

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests or writing code which can be incorporated into the project.

All members of our community are expected to follow our [Code of Conduct](https://wiki.aragon.org/documentation/Code_of_Conduct/). Please make sure you are welcoming and friendly in all of our spaces.

## Your first contribution

Unsure where to begin contributing to aragonOS?

You can start with a [Good First Issue](https://github.com/aragon/aragonOS/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

> Good first issues are usually for small features, additional tests, spelling / grammar fixes, formatting changes, or other clean up.

Start small, pick a subject you care about, are familiar with, or want to learn.

If you're not already familiar with git or Github, here are a couple of friendly tutorials: [First Contributions](https://github.com/firstcontributions/first-contributions), [Open Source Guide](https://opensource.guide/), and [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github).

## How to file an issue or report a bug

If you see a problem, you can report it in our [issue tracker](https://github.com/aragon/aragonOS/issues).

Please take a quick look to see if the issue doesn't already exist before filing yours.

Do your best to include as many details as needed in order for someone else to fix the problem and resolve the issue.

#### If you find a security vulnerability, do NOT open an issue. Email security@aragon.org instead.

In order to determine whether you are dealing with a security issue, ask yourself these two questions:

- Can I access or steal something that's not mine, or access something I shouldn't have access to?
- Can I disable something for other people?

If the answer to either of those two questions are "yes", then you're probably dealing with a security issue. Note that even if you answer "no" to both questions, you may still be dealing with a security issue, so if you're unsure, please send a email.

#### A [bug bounty program](https://wiki.aragon.org/dev/bug_bounty/) is available for rewarding contributors who find security vulnerabilities with payouts up to $50,000.

## Fixing issues

1. [Find an issue](https://github.com/aragon/aragonOS/issues) that you are interested in.
    - You may want to ask on the issue or on Aragon Chat's [#dev channel](https://aragon.chat/channel/dev) if anyone has already started working on the issue.
1. Fork and clone a local copy of the repository.
1. Make the appropriate changes for the issue you are trying to address or the feature that you want to add.
	  - Make sure to add tests!
1. Push the changes to the remote repository.
1. Submit a pull request in Github, explaining any changes and further questions you may have.
1. Wait for the pull request to be reviewed.
1. Make changes to the pull request if the maintainer recommends them.
1. Celebrate your success after your pull request is merged!

It's OK if your pull request is not perfect (no pull request is).
The reviewer will be able to help you fix any problems and improve it!

You can also edit a page directly through your browser by clicking the "EDIT" link in the top-right corner of any page and then clicking the pencil icon in the github copy of the page.

## Styleguide and development processes

We generally follow [Solidity's style guide](https://solidity.readthedocs.io/en/v0.4.24/style-guide.html) and have set up [Ethlint](https://github.com/duaraghav8/Ethlint) to automatically lint the project.

Due to the sensitive nature of Solidity, usually at least two reviewers are required before merging any pull request with code changes.

### Licensing

aragonOS is generally meant to be used as a library by developers but includes core components that are not generally useful to extend. Any interfaces or contracts meant to be used by other developers are licensed as MIT and have their Solidity pragmas left unpinned. All other contracts are licensed as GPL-3 and are pinned to a specific Solidity version.

## Community

If you need help, please reach out to Aragon core contributors and community members in the Aragon Chat [#dev](https://aragon.chat/channel/dev) [#dev-help](https://aragon.chat/channel/dev-help) channels.  We'd love to hear from you and know what you're working on!
