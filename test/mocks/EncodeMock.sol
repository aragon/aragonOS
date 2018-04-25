pragma solidity 0.4.18;

contract EncodeMockInterface {
    function gogo(bytes a, bytes b, address[] c) public;
}

contract EncodeMock {
    bytes public result;

    function exec(bytes a, bytes b, address[] c) public {
        EncodeMockInterface(this).gogo(a, b, c);
    }

    function () public {
        result = msg.data;
    }
}
