/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../apps/AppStorage.sol";


contract Initializable is UnstructuredStorage {
    modifier onlyInit {
        require(getStorageUint256(initializationBlockPosition) == 0);
        _;
    }

    modifier isInitialized {
        require(getStorageUint256(initializationBlockPosition) > 0);
        _;
    }

    /**
    * @return Block number in which the contract was initialized
    */
    function getInitializationBlock() public view returns (uint256) {
        return getStorageUint256(initializationBlockPosition);
    }

    /**
    * @dev Function to be called by top level contract after initialization has finished.
    */
    function initialized() internal onlyInit {
        setStorageUint256(initializationBlockPosition, getBlockNumber());
    }

    /**
    * @dev Returns the current block number.
    *      Using a function rather than `block.number` allows us to easily mock the block number in
    *      tests.
    */
    function getBlockNumber() internal view returns (uint256) {
        return block.number;
    }
}
