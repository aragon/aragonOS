pragma solidity 0.4.18;


contract KernelStorage {
    bytes32 constant public KERNEL_APP_ID = bytes32(0); //keccak256("kernel.aragonpm.eth");
    mapping (bytes32 => address) code;
}
