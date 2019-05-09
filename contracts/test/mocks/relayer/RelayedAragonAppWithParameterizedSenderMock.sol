pragma solidity 0.4.24;

import "../../../relayer/RelayedAragonAppWithParameterizedSender.sol";


contract RelayedAragonAppWithParameterizedSenderMock is RelayedAragonAppWithParameterizedSender {
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
        _write(_x);
    }

    function relayedWrite(address _sender, uint256 _x) public relayedAuthP(_sender, WRITING_ROLE, arr(_x)) {
        _write(_x);
    }

    function _write(uint256 _x) internal {
        x = _x;
    }
}
