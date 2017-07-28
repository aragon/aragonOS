pragma solidity ^0.4.13;

import "./IOrgan.sol";
import "./IMetaOrgan.sol";
import "../kernel/KernelRegistry.sol";

// @dev MetaOrgan can modify all critical aspects of the DAO.
contract MetaOrgan is IMetaOrgan, IOrgan, KernelRegistry {
    bytes32 constant PERMISSION_ORACLE_KEY = sha3(0x01, 0x03);

    /**
    * @notice Destruct organization for ever (non-recoverable)
    * #bylaw voting:80,100
    */
    function ceaseToExist() external {
        // Check it is called in DAO context and not from the outside which would
        // delete the organ logic from the EVM
        address self = getSelf();
        assert(this == self && self > 0);
        selfdestruct(0xdead);
    }

    /**
    * @notice Change DAO Kernel to Kernel at address `address`
    * #bylaw voting:75,0
    */
    function replaceKernel(address newKernel) external {
        setKernel(newKernel);
        KernelReplaced(newKernel);
    }

    /**
    * @notice Set `address` as permissions oracle
    * #bylaw voting:75,0
    */
    function setPermissionsOracle(address newOracle) external {
        storageSet(PERMISSION_ORACLE_KEY, uint256(newOracle));
        PermissionsOracleReplaced(newOracle);
    }

    /**
    * @notice Install application at address `address`
    * #bylaw status:3
    * @param appAddress address of the receiving contract for functions
    * @param sigs should be ordered from 0x0 to 0xffffffff
    */
    function installApp(address appAddress, bytes4[] sigs) external {
        register(appAddress, sigs, false);
    }

    /**
    * @notice Install organ at address `address`
    * #bylaw voting:75,0
    * @param organAddress address of the receiving contract for functions
    * @param sigs should be ordered from 0x0 to 0xffffffff
    */
    function installOrgan(address organAddress, bytes4[] sigs) external {
        register(organAddress, sigs, true);
    }

    /**
    * @notice Remove organ, you will lose functionality in your org
    * #bylaw voting:75,0
    * @param sigs should be ordered from 0x0 to 0xffffffff
    */
    function removeOrgan(bytes4[] sigs) external {
        deregister(sigs, true);
    }

    /**
    * @notice Remove application, you will lose functionality in your org
    * #bylaw voting:75,0
    * @param sigs should be ordered from 0x0 to 0xffffffff
    */
    function removeApp(bytes4[] sigs) external {
        deregister(sigs, false);
    }
}
