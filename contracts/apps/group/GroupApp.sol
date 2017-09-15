pragma solidity 0.4.15;

import "../App.sol";

import "../../common/IForwarder.sol";
import "../../common/EVMCallScript.sol";

contract GroupApp is App, Initializable, IForwarder, EVMCallScriptRunner {
    struct Identity {
        bool isMember;
        string name;
        bytes contentURI;
    }

    mapping (address => Identity) public members;
    bool public isWhitelist;

    event AddMember(address indexed addr);
    event UpdateIdentity(address indexed addr, string name);
    event RemoveMember(address indexed addr);

    modifier onlyMember {
        require(isMember(msg.sender));
        _;
    }

    function initialize(string _ctx, bool _isWhitelist) onlyInit {
        initialized();

        context = _ctx;
        isWhitelist = _isWhitelist;
    }

    function addMember(address _addr, string _name, bytes _contentURI) auth external {
        require(!isMember(_addr));
        members[_addr].isMember = true;
        _setIdentity(_addr, _name, _contentURI);
        AddMember(_addr);
    }

    function removeMember(address _addr) auth external {
        require(isMember(_addr));
        members[_addr].isMember = false;
        RemoveMember(_addr);
    }

    function setOwnIdentity(string _name, bytes _contentURI) onlyMember {
        _setIdentity(msg.sender, _name, _contentURI);
    }

    function setIdentity(address _addr, string _name, bytes _contentURI) auth external {
        _setIdentity(_addr, _name, _contentURI);
    }

    function _setIdentity(address _addr, string _name, bytes _contentURI) internal {
        members[_addr].name = _name;
        members[_addr].contentURI = _contentURI;
        UpdateIdentity(_addr, _name);
    }

    function forward(bytes _evmCallScript) onlyMember external {
        runScript(_evmCallScript);
    }

    function isMember(address _addr) constant returns (bool) {
        return isWhitelist && members[_addr].isMember;
    }

    function canForward(address _sender, bytes _evmCallScript) constant returns (bool) {
        _evmCallScript;
        return isMember(_sender);
    }
}
