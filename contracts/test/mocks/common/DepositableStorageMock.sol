pragma solidity 0.4.24;

import "../../../common/DepositableStorage.sol";


contract DepositableStorageMock is DepositableStorage {
    function setDepositableExt(bool _depositable) public {
        setDepositable(_depositable);
    }

    function getDepositablePosition() public pure returns (bytes32) {
        return DEPOSITABLE_POSITION;
    }
}
