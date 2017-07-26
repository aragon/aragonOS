pragma solidity ^0.4.11;

import "./ForwarderFactory.sol";
import "../apps/Application.sol";

contract ApplicationFactory is ForwarderFactory {
    address public baseApp;

    function ApplicationFactory(address _baseApp) {
        baseApp = _baseApp;
    }

    function deployApp(address _dao) returns (address app) {
        app = createForwarder(baseApp);
        Application(app).setDAO(_dao);
    }
}
