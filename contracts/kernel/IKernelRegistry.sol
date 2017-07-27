pragma solidity ^0.4.11;

import "../dao/DAOStorage.sol";

contract IKernelRegistryEvents {
    event Register(bytes4 indexed compId, address addr, bool isDelegate);
    event Deregister(bytes4 indexed compId, bool isDelegate);
}

contract IKernelRegistry is IKernelRegistryEvents {
    function get(bytes4 _sig) constant returns (address, bool);
}
