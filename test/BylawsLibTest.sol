pragma solidity ^0.4.8;

import "truffle/Assert.sol";
import "../contracts/apps/bylaws/BylawsLib.sol";

import "./mocks/BylawOracleMock.sol";

contract BylawsLibTest {
  using BylawsLib for BylawsLib.Bylaws;
  using BylawsLib for BylawsLib.Bylaw;
  BylawsLib.Bylaws bylaws;

  function testKeySignature() {
    Assert.equal(BylawsLib.keyForFunctionSignature('hi()'), bytes4(0xa99dca3f), 'Function signature should be correct for hi()');
    Assert.equal(BylawsLib.keyForFunctionSignature('bye(address,uint256)'), bytes4(0xf7b37331), 'Function signature should be correct for bye(...)');
  }

  function testAddBylaw() {
    bylaws.addBylaw(0x1, BylawsLib.initBylaw());
    var bylaw = bylaws.getBylaw(0x1);
    Assert.equal(uint(bylaw.updated), now, 'Should have been updated now');
    Assert.equal(bylaw.updatedBy, msg.sender, 'Should have been updated by sender');
  }

  function testAllowStatusBylaw() {
    bylaws.setStatusBylaw('testAllowStatusBylaw()', 3, false);
    Assert.equal(bylawType('testAllowStatusBylaw()'), 1, 'Should have correct bylaw type');
    Assert.isTrue(bylaws.canPerformAction(msg.sig, msg.sender, new bytes(0), 0), 'Should allow action with correct status');
  }

  function testDisallowStatusBylaw() {
    bylaws.setStatusBylaw('testDisallowStatusBylaw()', 5, false);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, msg.sender, new bytes(0), 0), 'Should not allow action with correct status');
  }

  function testAllowShareholderBylaw() {
    bylaws.setStatusBylaw('testAllowShareholderBylaw()', 0, true);
    Assert.equal(bylawType('testAllowShareholderBylaw()'), 2, 'Should have correct bylaw type');
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0xcafe, new bytes(0), 0), 'Should allow action for shareholder');
  }

  function testDisallowShareholderBylaw() {
    bylaws.setStatusBylaw('testDisallowShareholderBylaw()', 0, true);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0xcafeda, new bytes(0), 0), 'Shouldnt allow action when not shareholder');
  }

  function testAllowStocksaleBylaw() {
    bylaws.setStatusBylaw('testAllowStocksaleBylaw()', 1, true);
    Assert.equal(bylawType('testAllowStocksaleBylaw()'), 2, 'Should have correct bylaw type');
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0xcafeda, new bytes(0), 0), 'Should allow action for stocksale');
  }

  function testDisallowStocksaleBylaw() {
    bylaws.setStatusBylaw('testDisallowStocksaleBylaw()', 1, true);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0xcafe, new bytes(0), 0), 'Shouldnt allow action when not stocksale');
  }

  function testAllowAddressBylaw() {
    bylaws.setAddressBylaw('testAllowAddressBylaw()', 0xdead, false);
    Assert.equal(bylawType('testAllowAddressBylaw()'), 3, 'Should have correct bylaw type');
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0xdead, new bytes(0), 0), 'Should allow action for address');
  }

  function testDisallowAddressBylaw() {
    bylaws.setAddressBylaw('testDisallowAddressBylaw()', 0xdead, false);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0xdeaf, new bytes(0), 0), 'Shouldnt allow action when not address');
  }

  function testAllowOracleBylaw() {
    bylaws.setAddressBylaw('testAllowOracleBylaw()', new BylawOracleMock(true), true);
    Assert.equal(bylawType('testAllowOracleBylaw()'), 4, 'Should have correct bylaw type');
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0x0, new bytes(0), 0), 'Should allow action for allowing oracle');
  }

  function testDisallowOracleBylaw() {
    bylaws.setAddressBylaw('testDisallowOracleBylaw()', new BylawOracleMock(false), true);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0x0, new bytes(0), 0), 'Shouldnt allow action when oracle doesnt allow it');
  }

  function testAllowApprovedVoting() {
    bylaws.setVotingBylaw('testAllowApprovedVoting()', 75, 100, false, 5, 0);
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0x1, new bytes(0), 0), 'Should allow action with approved voting');
    Assert.equal(bylawType('testAllowApprovedVoting()'), 0, 'Should have correct bylaw type');
  }

  function testDisallowUnapprovedVoting() {
    bylaws.setVotingBylaw('testDisallowUnapprovedVoting()', 75, 100, true, 5, 0);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0x2, new bytes(0), 0), 'Shouldnt allow action with unapproved voting');
  }

  function testDisallowShortVoting() {
    bylaws.setVotingBylaw('testDisallowShortVoting()', 75, 100, false, 5, 0);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0x3, new bytes(0), 0), 'Shouldnt allow action with too short voting');
  }

  function testAllowRelativeResultsVoting() {
    bylaws.setVotingBylaw('testAllowRelativeResultsVoting()', 75, 100, true, 5, 0);
    Assert.isTrue(bylaws.canPerformAction(msg.sig, 0x4, new bytes(0), 0), 'Should allow with relative result voting');
  }

  function testUnallowVotingPowerIsOne() {
    bylaws.setVotingBylaw('testUnallowVotingPowerIsOne()', 75, 100, true, 5, 0);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0x5, new bytes(0), 0), 'Shouldnt allow action when voting power is one and votes 0');
  }

  function testUnallowCielingRounding() {
    bylaws.setVotingBylaw('testUnallowCielingRounding()', 1, 2, false, 5, 0);
    Assert.isFalse(bylaws.canPerformAction(msg.sig, 0x6, new bytes(0), 0), 'Shouldnt allow action when doing bad rounding');
  }

  function testVotingIsExecuted() {
    bylaws.setVotingBylaw('testVotingIsExecuted()', 75, 100, false, 5, 0);
    BylawsLib.Bylaw storage bylaw = bylaws.getBylaw(msg.sig);
    Assert.isTrue(bylaw.canPerformAction(msg.sig, 0x1, new bytes(0), 0), 'Should allow action with approved voting');

    hasExecuted = false;
    bylaw.performedAction(msg.sig, 0x1);
    Assert.isTrue(hasExecuted, 'Should have executed vote');
  }

  // Company hooks mocks

  bool hasExecuted;

  function bylawType(string sig) returns (uint) {
    uint8 t;
    uint64 u; address uu;

    (t, u, uu) = bylaws.getBylawType(sig);

    return uint(t);
  }

  function entityStatus(address x) returns (uint8) {
    return 3;
  }

  function isShareholder(address x) returns (bool) {
    return x == 0xcafe;
  }

  function isStockSale(address x) returns (bool) {
    return x == 0xcafeda;
  }

  function reverseVoting(address v) returns (uint) {
    if (v == 0x1) return 1;
    if (v == 0x2) return 2;
    if (v == 0x3) return 3;
    if (v == 0x4) return 4;
    if (v == 0x5) return 5;
    if (v == 0x6) return 6;
    return 0;
  }

  function getVotingInfo(uint vId) returns (address, uint64, uint64, bool, bool) {
    if (vId == 1) return (0x1, 0, 5, false, false);
    if (vId == 2) return (0x2, uint64(now), uint64(now + 5), false, false);
    if (vId == 3) return (0x3, 0, 1, false, false);
    if (vId == 4) return (0x4, uint64(now - 6), uint64(now - 1), false, false);
    if (vId == 5) return (0x5, 0, 5, false, false);
    if (vId == 6) return (0x6, 0, 5, false, false);
  }

  function countVotes(uint vId, uint8 o) returns (uint, uint, uint) {
    if (vId == 1) return (80, 80, 100);
    if (vId == 2) return (60, 80, 100);
    if (vId == 3) return (80, 80, 100);
    if (vId == 4) return (60, 80, 80);
    if (vId == 5) return (0, 0, 1);
    if (vId == 6) return (1, 1, 3);
  }

  function setVotingExecuted(uint vId, uint8 o) {
    if (vId == 1) hasExecuted = true;
  }
}
