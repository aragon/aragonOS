pragma solidity ^0.4.11;

contract ForwarderFactory {
    function createForwarder(address target) returns (address fwdContract) {
        // TODO: Comented as it is causing 'Internal compiler error: Assembly exception for bytecode'
        bytes32 b1 = 0x602e600c600039602e6000f33660006000376101006000366000730000000000; // length 27 bytes = 1b
        bytes32 b2 = 0x5af41558576101006000f3000000000000000000000000000000000000000000; // length 11 bytes

        uint256 shiftedAddress = uint256(target) * ((2 ** 8) ** 12);   // Shift address 12 bytes to the left

        assembly {
            let contractCode := mload(0x40)                 // Find empty storage location using "free memory pointer"
            mstore(contractCode, b1)                        // We add the first part of the bytecode
            mstore(add(contractCode, 0x1b), shiftedAddress) // Add target address
            mstore(add(contractCode, 0x2f), b2)             // Final part of bytecode
            fwdContract := create(0, contractCode, 0x3A)    // total length 58 dec = 3a
            switch extcodesize(fwdContract) case 0 { invalid() }
        }

        ForwarderDeployed(fwdContract, target);
    }

    event ForwarderDeployed(address forwarderAddress, address targetContract);
}
