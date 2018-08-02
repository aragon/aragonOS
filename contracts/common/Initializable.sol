/*
 * SPDX-License-Identitifer:    MIT
 */

pragma solidity ^0.4.18;

import "../apps/AppStorage.sol";


contract Initializable is UnstructuredStorage {
    // keccak256("aragonOS.initializable.initializationBlock")
    bytes32 internal constant initializationBlockPosition = 0xebb05b386a8d34882b8711d156f463690983dc47815980fb82aeeff1aa43579e;

    modifier onlyInit {
        require(getInitializationBlock() == 0);
        _;
    }

    modifier isInitialized {
        require(getInitializationBlock() > 0);
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
