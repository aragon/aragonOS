pragma solidity ^0.4.8;

import "../Application.sol";
import "./BylawsLib.sol";

contract BylawsApp is Application {
  using BylawsLib for BylawsLib.Bylaws;
  using BylawsLib for BylawsLib.Bylaw;

  event BylawChanged(string functionSignature, uint8 bylawType);

  BylawsLib.Bylaws bylaws;

  function BylawsApp(address _dao)
           Application(_dao) {}

  // Dispatcher permission oracle
  function canPerformAction(address sender, address token, uint256 value, bytes data) constant returns (bool) {
    bytes4 sig;
    assembly { sig := mload(add(data, 0x20)) }
    return canPerformAction(sig, sender, data);
  }

  function canPerformAction(bytes4 sig, address sender, bytes data) constant public returns (bool) {
    return canPerformAction(bylaws.bylaws[sig], sig, sender, data);
  }

  function canPerformAction(BylawsLib.Bylaw storage bylaw, bytes4 sig, address sender, bytes data) internal returns (bool) {
    return bylaw.canPerformAction(sig, sender, data, msg.value);
  }

  // Sensitive setters
  function setStatusBylaw(string functionSignature, uint8 statusNeeded, bool isSpecialStatus)
           onlyDao {
    bylaws.setStatusBylaw(functionSignature, statusNeeded, isSpecialStatus);
  }

  function setAddressBylaw(string functionSignature, address addr, bool isOracle)
           onlyDao {
    bylaws.setAddressBylaw(functionSignature, addr, isOracle);
  }

  function setVotingBylaw(string functionSignature, uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime, uint8 option)
           onlyDao {
    bylaws.setVotingBylaw(functionSignature, support, base, closingRelativeMajority, minimumVotingTime, option);
  }

  // Read functions
  function getBylawType(string functionSignature) constant returns (uint8 bylawType, uint64 updated, address updatedBy) {
    return bylaws.getBylawType(functionSignature);
  }

  function getStatusBylaw(string functionSignature) constant returns (uint8) {
    BylawsLib.Bylaw memory b = bylaws.getBylaw(functionSignature);

    if (b.status.enforced) return b.status.neededStatus;

    return uint8(255);
  }

  function getVotingBylaw(string functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    return getVotingBylaw(bytes4(sha3(functionSignature)));
  }

  function getVotingBylaw(bytes4 functionSignature) constant returns (uint256 support, uint256 base, bool closingRelativeMajority, uint64 minimumVotingTime) {
    BylawsLib.VotingBylaw memory b = bylaws.getBylaw(functionSignature).voting;

    if (!b.enforced) return;

    support = b.supportNeeded;
    base = b.supportBase;
    closingRelativeMajority = b.closingRelativeMajority;
    minimumVotingTime = b.minimumVotingTime;
  }

  function getAddressBylaw(string functionSignature) constant returns (address) {
    BylawsLib.AddressBylaw memory b = bylaws.getBylaw(functionSignature).addr;

    if (!b.enforced) return;

    return b.addr;
  }
}
