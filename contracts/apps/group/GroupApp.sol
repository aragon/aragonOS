pragma solidity 0.4.15;

import "../App.sol";

import "../../common/IForwarder.sol";
import "../../common/EVMCallScript.sol";

contract GroupApp is App, Initializable, IForwarder, EVMCallScriptRunner {
    mapping (address => bool) member;

    event AddMember(address indexed addr);
    event RemoveMember(address indexed addr);

    modifier onlyMember {
        require(isMember(msg.sender));
        _;
    }

    function initialize(string _ctx) {
        initialized();

        context = _ctx;
    }

    function addMember(address _addr) auth external {
        require(!isMember(_addr));
        member[_addr] = true;
        AddMember(_addr);
    }

    function removeMember(address _addr) auth external {
        require(isMember(_addr));
        member[_addr] = false;
        RemoveMember(_addr);
    }

    function forward(bytes _evmCallScript) onlyMember external {
        runScript(_evmCallScript);
    }

    function isMember(address _addr) constant returns (bool) {
        return member[_addr];
    }

    function canForward(address _sender, bytes _evmCallScript) constant returns (bool) {
        _evmCallScript;
        return isMember(_sender);
    }
}
