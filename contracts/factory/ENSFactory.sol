pragma solidity 0.4.18;

import "../lib/ens/ENS.sol";
import "../lib/ens/PublicResolver.sol";
import "../ens/ENSConstants.sol";


// Note that this contract is NOT meant to be used in production.
// Its only purpose is to easily create ENS instances for testing APM.
contract ENSFactory is ENSConstants {
    event DeployENS(address ens);

    // This is an incredibly trustfull ENS deployment, only use for testing
    function newENS(address _owner) public returns (ENS ens) {
        ens = new ENS();

        // Setup .eth TLD
        ens.setSubnodeOwner(ENS_ROOT, ETH_TLD_LABEL, this);

        // Setup public resolver
        PublicResolver resolver = new PublicResolver(ens);
        ens.setSubnodeOwner(ETH_TLD_NODE, PUBLIC_RESOLVER_LABEL, this);
        ens.setResolver(PUBLIC_RESOLVER_NODE, resolver);
        resolver.setAddr(PUBLIC_RESOLVER_NODE, resolver);

        ens.setOwner(ETH_TLD_NODE, _owner);
        ens.setOwner(ENS_ROOT, _owner);

        DeployENS(ens);
    }
}
