pragma solidity 0.4.24;

import "../../../apps/AragonApp.sol";


contract KillSwitchedAppMock is AragonApp {
    bytes32 public constant WRITER_ROLE = keccak256("WRITER_ROLE");
    string private constant ERROR_AUTH_FAILED = "APP_AUTH_FAILED";

    address public owner;
    uint256 internal data;

    modifier oldAuth(bytes32 _role) {
        require(_oldCanPerform(msg.sender, _role, new uint256[](0)), ERROR_AUTH_FAILED);
        _;
    }

    function initialize(address _owner) public onlyInit {
        initialized();
        data = 42;
        owner = _owner;
    }

    function read() public view returns (uint256) {
        return data;
    }

    function write(uint256 _data) public auth(WRITER_ROLE) {
        data = _data;
    }

    function writeWithoutKillSwitch(uint256 _data) oldAuth(WRITER_ROLE) public {
        data = _data;
    }

    function reset() public auth(WRITER_ROLE) {
        data = 0;
    }

    function _oldCanPerform(address _sender, bytes32 _role, uint256[] _params) private view returns (bool) {
        if (!hasInitialized()) {
            return false;
        }
        IKernel _kernel = kernel();
        if (address(_kernel) == address(0)) {
            return false;
        }
        return _kernel.hasPermission(_sender, address(this), _role, ConversionHelpers.dangerouslyCastUintArrayToBytes(_params));
    }
}
