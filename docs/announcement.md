---

Introducing aragonOS 3.0 alpha, the new operating system for protocols and DApps
Smart contract codebase has been frozen, audit with WHG starts today and announcement for Aragon v0.5 release schedule


The scope of Aragon’s influence has been broadening ever since the team started growing from just myself and Luis to a dozen of brilliant freedom fighters. We’ve had serious conversations, both community-wide and internally,  about the direction that Aragon should take. We’ve gone from it being a nice way to manage a traditional business to a full-stack governance platform for sovereign individuals, organizations and protocols in the blockchain. This has made us analyze and re-evaluate just what are we building many times over.
Since the Aragon Core alpha version 0.3 was released back in March 2017, we have done almost three full refactorings of the entire codebase. Every time we thought we were almost there, we discovered some properties which we didn’t like or came up with some ideas on how to improve it, and those brought us back to the drawing board.
One could say that this was my responsibility as technical lead and that the delay has been caused due to shortcomings in planning and specifications. And that would be partly right and I assume those mistakes as only my own.
However, I don’t believe for a second that we would be here today without all the missteps and technical explorations of different techniques. After completing this release, it feels absolutely right, and are proud of every step taken to get here. Some of the best crypto projects out there have always said that they ‘will ship when the code is ready’. We feel this is ‘ready time’ for us and we are extremely confident with the foundation that we’ve laid down for the future.
What is aragonOS? (2018 edition)
aragon/aragonOS
Official reference implementation for aragonOSgithub.com
2017 was a year full of fun experiments and ICOs, but it is about time to take serious systems to production. These systems need to be effectively governed by something more decentralized than a multisig wallet and will need to be upgraded at some point in the future. It  is also time to make onlyOwner smart contract governance a thing of the past.
aragonOS is smart contract development framework with a very strong focus on governance and upgradeability. This architecture can be used by any complex DApp or protocol and it allows extendability with the ability to plug in any Aragon governance module. It was originally designed to build modular DAOs, but we ended up abstracting it more and more to the point where it would be useful as the fundamental building block of any decentralized project.
aragonOS will be the core of all Aragon organizations, as well as the upcoming Aragon Network. Applications and protocols built with aragonOS will be able to easily take advantage of Aragon Network’s features. Of course this is completely opt-in, as using aragonOS independently will always be free and it doesn’t require any tokens whatsoever. 
After many months researching and experimenting on these topics, we can already see it paying off. aragonOS upgradeability approach is now being used to build incredible projects such as zeppelinOS Proxy, and our DelegateProxy implementation is already being used on the Mainnet to power Decentraland’s LAND token.
We are now moving from helping to set these industry best practices into providing a secure framework that anyone can plug in and run. Our development documentation is still catching up to the latest changes (we will be delighted to help with questions about the system in aragon.chat), making this a perfect opportunity to mention that we are looking for a Developer Relations person and EVM engineers to join the Aragon team!
aragonOS 3.0 release highlights
From the initial specification of aragonOS to the latest release, there have been many improvements across the board.
We have done a bunch of architectural changes that have resulted in a more elegant and modular system. The animation below illustrates the lifecycle of a call to an Aragon app.

Lifecycle of an action performed in an Aragon app
After many optimizations we have gotten the baseline cost for a call that doesn’t use the ACL (a public action in an app, such as casting a vote) to an average of ~29,181 gas (slightly varies depending on compiler optimizations and the position of the function in the bytecode) up from ~21,444 gas that costs calling an empty function in a vanilla Solidity contract.
In the case of an action protected behind the ACL, as in the figure above, the baseline cost is ~47,136 gas. It is worth noting that once payed the baseline cost, apps behave and spend gas as ‘normal’ non-upgradeable contracts. We consider these numbers to be absolutely reasonable for the upgradeability and modularity benefits, as well as being able to remove all auth logic from the real business logic of contracts, but we are looking for further optimizations to make using the system cheaper.
Access Control List rule interpretation
ACL interfacePreviously our Access Control List (ACL) implementation was purely binary in nature. An entity would either be allowed to perform an action on an app or be denied to perform that action.
In aragonOS 3.0 we introduce the ability to parametrize rules that will be interpreted on ACL checks. For example, this can now be done in the Finance App:
function makePayment(address token, address to, uint amount) auth(MAKE_PAYMENT_ROLE, token, amount) { ... } 
In the codeblock above, the auth modifier parametrizes the role with the provided token and amount as part of the call arguments, as well as other global parameters such as timestamp, block number or an oracle check. Using the new rule interpreter, you can directly create rules in the ACL to limit the amount or type of tokens that different entities can transfer or work with, all this without modifying any code in the Finance app.
Actually the interpreter supports encoding complex rules in what would look almost like a programming language, for example let’s look at the following test case:
ACL interpreter exampleWhen assigned to a permission, this rule will evaluate to true (and therefore allow the action) if an oracle accepts it and the block number is greater than the previous block number, and either the oracle allows it (again! testing redundancy too) or the first parameter of the rule is lower than 10. The possibilities for customizing organizations/DApps governance model are truly endless, without the need to write any actual Solitidy.
Forwarders and EVM scripts
Forwarders are one of the most important concepts of aragonOS. Rather than hardcoding the notion of a vote into each separate app’s functionality and ACL, one can instead use a generic Voting App, which implements the forwarding interface, to pass actions forward to other apps after successful votes. If the Voting App is set up to only allow a token’s holders to vote, that means any actions/calls being passed from it must have been approved by the token’s holders.
The forwarding interface also allows the Aragon client through aragon.js to calculate what we call ‘forwarding paths’. If you wish to perform an action and the client determines you don’t have direct permission to do it, it will think of alternative paths for execution. For example, you might directly go to the Vault App wishing to perform a token transfer, and the client directly prompts you to create a vote, as you have permission to create votes, that will perform the transfer if successful, as illustrated in the animation below.

Transaction pathing and forwarding visualization (governance model and characters are fictional)
We have designed our own scripting format, known as EVM scripts, to encode complex actions into a representation that can be stored and later executed by another entity. aragonOS 3.0 allows you to have multiple script executors that can be housed in your organization. Script executors are contracts that take a script and an input and return an output after execution. We have built three script executors for the initial release:
CallsScript: A simple way to concatenate multiple calls. It cancels the operation if any of the calls fail.
DelegateScript: delegatecalls into a given contract, which basically allows for any arbitrary computation within the EVM in the caller’s context.
DeployDelegateScript: Is a superset of the DelegateScript, but it takes a full contract bytecode as its script body instead of just an address. On execution, it deploys the contract to the blockchain and executes with delegatecall.

We have been deeply inspired by Maker’s ds-proxy and some of their other work for DAI keepers when designing EVMScripts.
100% test coverage
We have pushed hard to achieve a 100% test coverage in the aragonOS codebase. 100% code coverage means that every line and execution branch of the Solidity code in aragonOS is executed against at least one test case.
However, code coverage is not a silver bullet: there could be bugs which aren’t showing up in these tests as we might not be testing properly for every possible execution or code path, or some other thing we haven’t thought of testing yet.
100% code coverage is a good metric to maintain going forward. It has become a test in itself. No Pull Request will be merged into the aragonOS repo from now on that breaks the 100% coverage metric.
This is how 100% coverage looks likeAragon App-etite
While building the Aragon Core version 0.5 we found ourselves doing recursive architecturing over and over again. The ACL and the EVMScriptRegistry infrastructure are now Aragon Apps themselves which run within the organization and can be accessed by other apps. This means that organizations can now choose to use another implementation of those or build their own for this core components.
On this same note, the Aragon Package Manager (APM) has been re-architectured and integrated as a part of aragonOS. It is now a DAO running on the same Aragon (taking advantage of upgradeability and access control), that‘s used to build Aragon DAOs! This will allow to have many APM registries with different governance models for package publishing and releasing new versions, from an Aragon curated one, aragonpm.eth, which will have very strict restrictions of what gets published and high quality standards,  for our core components, to completely community ran registries in which everyone can publish their packages. 
This is a perfect example of a DApp that takes advantage of being built with aragonOS but which isn’t exactly a decentralized organization. It used to be its own separate system with custom governance logic, but we realized that it would be better off taking advantage of all the work done on aragonOS.

Aragon Package Manager DAO architecture (ignoring proxies for simplicity)
The user experience for developing Aragon apps has improved a lot. And in the process of researching and developing all this, we have found ourselves working on some nice side-projects on top of Aragon. We’ve opened a new GitHub organization for experimentation called Aralabs. For example, Oliver has been building a generic Staking app, that combined with our existing Voting App and a simple Registry App, can make for a pretty nice Token Curated Registry.
Aralabs
GitHub is where people build software. More than 27 million people use GitHub to discover, fork, and contribute to over…github.com
Security
We feel the potential for aragonOS to become a standard framework for developing complex and upgradeable DApps, and therefore we are taking security extremely seriously.
Before calling aragonOS 3.0 an alpha release, Aragon’s EVM Engineer Brett did an internal audit of the code. His audit did not find any significant threats, but it did help in continuing to polish some rough edges.
 However, we won’t consider aragonOS ready for a production deployment until it has been through an independent audit and some weeks of high stakes bug bounties.
Audit (Internal) by Brett Sun - Aragon Wiki
Wiki for the Aragon Projectwiki.aragon.one
Third-party audit
Today, we are starting an audit process with the incredibly talented White Hat Group (WHG). A team of 6 auditors led by Jordi Baylina will be taking apart aragonOS to find any vulnerabilities. We are delighted that they have decided to work with us and we are looking forward to improving aragonOS further with their findings and comments.
As a reference, they audited Maker’s DAI in December of last year and produced this thorough report.
After the WHG audit is done, we will do live bug bounties. We’ll basically deploy DAOs on the Mainnet, send some funds to them and encourage hackers to break them and get the funds inside. We are evaluating the need for doing further security audits on the code.
When marketing? When news? When v0.5?
Our next release after v0.3 has been under development for almost a year now. With this kind of project, a lot of research is required. And research and development in this space takes time compared to legacy, centralized, projects.
Today, I feel confident to publicly commit to releasing aragonOS 3.0 powered Aragon Core v0.5 alpha in February 2018.
We have been quiet. We have been busy building, not hyping. But we cannot hide our excitement any more. We can’t wait for the world to get their hands on what we have been working on for so long. It’s going to blow your mind.
 — The Aragon Team 🦅


---

To keep up with the progress of Aragon:
Join the team
Come chat with us at the Aragon Chat
Follow Aragon on Twitter
Subscribe to the Aragon subreddit
Follow Aragon at LinkedIn
Contribute to Aragon on GitHub
Find us on Youtube
Explore the Aragon Wiki
