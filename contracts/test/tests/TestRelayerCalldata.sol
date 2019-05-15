pragma solidity 0.4.24;

import "../helpers/Assert.sol";
import "../../relayer/Relayer.sol";
import "../../common/MemoryHelpers.sol";


contract RelayedAppTest is RelayedAragonApp {
    function callme(uint8 x, bytes32 y, string z) public {
        bytes memory calldata = msg.data;
        //   4    32      32               32                32            32        32
        // [sig][uint8][bytes32][string starting offset][string size][string word][signer]
        Assert.equal(calldata.length, 4 + 32 * 6, "should have correct length");

        _assertCalldataWord(0x04, bytes32(0x000000000000000000000000000000000000000000000000000000000000000f));
        _assertCalldataWord(0x24, bytes32(0x0000000000000000000000000000000000000000000000000000000000000f00));
        _assertCalldataWord(0x44, bytes32(0x0000000000000000000000000000000000000000000000000000000000000060));
        _assertCalldataWord(0x64, bytes32(0x0000000000000000000000000000000000000000000000000000000000000007));
        _assertCalldataWord(0x84, bytes32(0x72656c6179656400000000000000000000000000000000000000000000000000));
        _assertCalldataWord(0xa4, bytes32(TestRelayerCalldata(msg.sender).signer()));
    }

    function _assertCalldataWord(uint256 _pos, bytes32 _expectedValue) private {
        bytes32 actualValue;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 0x20))
            calldatacopy(ptr, _pos, 0x20)
            actualValue := mload(ptr)
        }
        Assert.equal(actualValue, _expectedValue, "calldata values should match");
    }
}

contract TestRelayerCalldata is Relayer {
    RelayedAppTest public appTest;

    address public signer;

    constructor () public {
        appTest = new RelayedAppTest();
    }

    function testSignerEncodedCalls() public {
        signer = msg.sender;
        bytes memory calldata = abi.encodeWithSelector(appTest.callme.selector, uint8(15), bytes32(0xf00), "relayed");
        _relayCall(signer, address(appTest), calldata);
    }
}
