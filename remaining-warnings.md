# Remaining warnings

This file will be deleted before PR is merged.


### Shadow declarations

```
/home/tony/aragon/aragonOS/contracts/lib/ens/PublicResolver.sol:85:36: Warning: This declaration shadows an existing declaration.
    function setAddr(bytes32 node, address addr) only_owner(node) public {
                                   ^----------^
/home/tony/aragon/aragonOS/contracts/lib/ens/PublicResolver.sol:75:5: The shadowed declaration is here:
    function addr(bytes32 node) public constant returns (address ret) {
    ^
Spanning multiple lines.

,/home/tony/aragon/aragonOS/contracts/lib/ens/PublicResolver.sol:130:36: Warning: This declaration shadows an existing declaration.
    function setName(bytes32 node, string name) only_owner(node) public {
                                   ^---------^
/home/tony/aragon/aragonOS/contracts/lib/ens/PublicResolver.sol:120:5: The shadowed declaration is here:
    function name(bytes32 node) public constant returns (string ret) {
    ^
Spanning multiple lines.

,/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:58:37: Warning: This declaration shadows an existing declaration.
    function setOwner(bytes32 node, address owner) only_owner(node) public {
                                    ^-----------^
/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:34:5: The shadowed declaration is here:
    function owner(bytes32 node) public constant returns (address) {
    ^
Spanning multiple lines.

,/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:70:59: Warning: This declaration shadows an existing declaration.
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) only_owner(node) public {
                                                          ^-----------^
/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:34:5: The shadowed declaration is here:
    function owner(bytes32 node) public constant returns (address) {
    ^
Spanning multiple lines.

,/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:81:40: Warning: This declaration shadows an existing declaration.
    function setResolver(bytes32 node, address resolver) only_owner(node) public {
                                       ^--------------^
/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:41:5: The shadowed declaration is here:
    function resolver(bytes32 node) public constant returns (address) {
    ^
Spanning multiple lines.

,/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:91:35: Warning: This declaration shadows an existing declaration.
    function setTTL(bytes32 node, uint64 ttl) only_owner(node) public {
                                  ^--------^
/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:48:5: The shadowed declaration is here:
    function ttl(bytes32 node) public constant returns (uint64) {
    ^
Spanning multiple lines.
```

### Solidity warning about Metropolis

See (https://github.com/ethereum/solidity/issues/3273)

```
,/home/tony/aragon/aragonOS/contracts/evmscript/EVMScriptRunner.sol:41:25: Warning: The "returndatasize" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
            let size := returndatasize
                        ^------------^
,/home/tony/aragon/aragonOS/contracts/evmscript/EVMScriptRunner.sol:47:17: Warning: The "returndatacopy" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
                returndatacopy(ret, 0x20, sub(size, 0x20)) // copy return data
                ^------------^
,/home/tony/aragon/aragonOS/contracts/common/DelegateProxy.sol:14:25: Warning: The "returndatasize" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
            let size := returndatasize
                        ^------------^
,/home/tony/aragon/aragonOS/contracts/common/DelegateProxy.sol:17:13: Warning: The "returndatacopy" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
            returndatacopy(ptr, 0, size)
            ^------------^
,/home/tony/aragon/aragonOS/contracts/evmscript/executors/DelegateScript.sol:56:25: Warning: The "returndatasize" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
            let size := returndatasize
                        ^------------^
,/home/tony/aragon/aragonOS/contracts/evmscript/executors/DelegateScript.sol:60:13: Warning: The "returndatacopy" instruction is only available after the Metropolis hard fork. Before that it acts as an invalid instruction.
            returndatacopy(add(ret, 0x20), 0, size) // copy return data
            ^------------^
```

### Left alignment by default

```
,/home/tony/aragon/aragonOS/contracts/lib/ens/ENS.sol:28:17: Warning: Decimal literal assigned to bytesXX variable will be left-aligned. Use an explicit conversion to silence this warning.
        records[0].owner = msg.sender;
                ^
```

### Unused function parameters

```
,/home/tony/aragon/aragonOS/contracts/acl/ACLSyntaxSugar.sol:5:43: Warning: Unused function parameter. Remove or comment out the variable name to silence this warning.
    function arr() internal pure returns (uint256[] r) {}
                                          ^---------^
,/home/tony/aragon/aragonOS/contracts/evmscript/executors/CallsScript.sol:24:40: Warning: Unused function parameter. Remove or comment out the variable name to silence this warning.
    function execScript(bytes _script, bytes _input, address[] _blacklist) external returns (bytes) {
                                       ^----------^
```

### Purity questions w.r.t. assembly

```
,/home/tony/aragon/aragonOS/contracts/evmscript/EVMScriptRunner.sol:39:5: Warning: Function state mutability can be restricted to pure
    function returnedDataDecoded() internal view returns (bytes ret) {
    ^
Spanning multiple lines.
,/home/tony/aragon/aragonOS/contracts/evmscript/executors/DelegateScript.sol:54:5: Warning: Function state mutability can be restricted to pure
    function returnedData() internal view /* TODO /pure/? */ returns (bytes ret) {
    ^
Spanning multiple lines.
,/home/tony/aragon/aragonOS/contracts/lib/minime/MiniMeToken.sol:305:56: Warning: Function declared as view, but this expression (potentially) modifies the state and thus requires non-payable (the default) or payable.
                return parentToken.balanceOfAt(_owner, min(_blockNumber, parentSnapShotBlock));
                                                       ^------------------------------------^
,/home/tony/aragon/aragonOS/contracts/lib/minime/MiniMeToken.sol:329:50: Warning: Function declared as view, but this expression (potentially) modifies the state and thus requires non-payable (the default) or payable.
                return parentToken.totalSupplyAt(min(_blockNumber, parentSnapShotBlock));
                                                 ^------------------------------------^
,/home/tony/aragon/aragonOS/contracts/lib/minime/MiniMeToken.sol:489:5: Warning: Function state mutability can be restricted to pure
    function min(uint a, uint b) internal returns (uint) {
    ^
Spanning multiple lines.
```


