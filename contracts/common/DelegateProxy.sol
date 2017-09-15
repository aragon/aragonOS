pragma solidity 0.4.15;

contract DelegateProxy {
    /**
    * @dev Performs a delegatecall and returns whatever the delegatecall returned (entire context execution will return!)
    * @param _dst Destination address to perform the delegatecall
    * @param _calldata Calldata for the delegatecall
    */
    function delegatedFwd(address _dst, bytes _calldata) internal {
        assembly {
            switch extcodesize(_dst) case 0 { revert(0, 0) }
            let result := delegatecall(sub(gas, 10000), _dst, add(_calldata, 0x20), mload(_calldata), 0, 0)
            switch result case 0 { revert(0, 0 } // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
            let size := returndatasize
            switch size case 0 { return(0, 0) }

            let ptr := mload(0x40)
            returndatacopy(ptr, 0, size)
            return(ptr, size)
        }
    }
}
