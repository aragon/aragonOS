pragma solidity ^0.4.13;

/**
* @title DAO base contract
* @author Jorge Izquierdo (Aragon)
* @description DAO is the base contract on top of which all DAO lives.
* This is the only element of the DAO that is non-upgradeable
* Given the simplicity of this contract, it could be written in LLL and/or
* be formally proven.
*/

import "./DAOStorage.sol";
contract DAO is DAOStorage {
	/**
	* @dev DAO constructor references to the DAO kernel and saves its own identity as self
	* @param deployedKernel instance of a Kernel to be linked with the DAO
	*/
	function DAO(address deployedKernel) {
		setKernel(deployedKernel);
		setSelf(this);

		// setupOrgans() function needs to be called in DAO's context
		assert(deployedKernel.delegatecall(setupOrgansSig, deployedKernel));
		assert(deployedKernel == getKernel());
	}
	bytes4 constant setupOrgansSig = bytes4(sha3("setupOrgans(address)"));

	/**
	* @dev All calls to the DAO are forwarded to the kernel with a delegatecall
	* @return - the underlying call returns (upto RETURN_MEMORY_SIZE memory)
	*/
	function () payable public {
        uint32 len = RETURN_MEMORY_SIZE;
        address target = getKernel();
        require(target > 0);  // fails if kernel hasn't been set
        assembly {
            calldatacopy(0x0, 0x0, calldatasize)
            let result := delegatecall(sub(gas, 10000), target, 0x0, calldatasize, 0, len)
            switch result case 0 { invalid() }
            return(0, len)
        }
    }
}
