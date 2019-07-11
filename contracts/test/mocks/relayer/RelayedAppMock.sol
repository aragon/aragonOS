pragma solidity 0.4.24;

import "../../../relayer/RelayedAragonApp.sol";


contract RelayedAppMock is RelayedAragonApp {
    bytes32 public constant WRITING_ROLE = keccak256("WRITING_ROLE");

    uint256 private x;

    function initialize() public onlyInit {
        initialized();
        x = 42;
    }

    function read() public view returns (uint256) {
        return x;
    }

    function write(uint256 _x) public authP(WRITING_ROLE, arr(_x)) {
        x = _x;
    }
}
