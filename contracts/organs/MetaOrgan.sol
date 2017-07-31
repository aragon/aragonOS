pragma solidity ^0.4.11;

import "./IOrgan.sol";
import "./IMetaOrgan.sol";
import "../kernel/KernelRegistry.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is IMetaOrgan, IOrgan, KernelRegistry {
    bytes32 constant PERMISSION_ORACLE_KEY = sha3(0x01, 0x03);

    function ceaseToExist() public {
        // Check it is called in DAO context and not from the outside which would
        // delete the organ logic from the EVM
        address self = getSelf();
        assert(this == self && self > 0);
        selfdestruct(0xdead);
    }

    function replaceKernel(address newKernel) public {
        setKernel(newKernel);
        KernelReplaced(newKernel);
    }

    function setPermissionsOracle(address newOracle) public {
        storageSet(PERMISSION_ORACLE_KEY, uint256(newOracle));
        PermissionsOracleReplaced(newOracle);
    }

    // @param appAddress: address of the receiving contract for functions
    // @param sigs: should be ordered from 0x0 to 0xffffffff
    function installApp(address appAddress, bytes4[] sigs) public {
        register(appAddress, sigs, false);
    }

    // @param organAddress: address of the receiving contract for functions
    // @param sigs: should be ordered from 0x0 to 0xffffffff
    function installOrgan(address organAddress, bytes4[] sigs) public {
        register(organAddress, sigs, true);
    }

    function removeOrgan(bytes4[] sigs) public {
        deregister(sigs, true);
    }

    function removeApp(bytes4[] sigs) public {
        deregister(sigs, false);
    }
}
