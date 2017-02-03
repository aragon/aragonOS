var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("AbstractCompany error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("AbstractCompany error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("AbstractCompany contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of AbstractCompany: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to AbstractCompany.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: AbstractCompany not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "1234": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "issueReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAccountingPeriodRemainingBudget",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "reverseSales",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newStock",
            "type": "address"
          },
          {
            "name": "issue",
            "type": "uint256"
          }
        ],
        "name": "addStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "stockIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_sale",
            "type": "uint256"
          }
        ],
        "name": "transferSaleFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          },
          {
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "setEntityStatusByStatus",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "saleAddress",
            "type": "address"
          }
        ],
        "name": "beginSale",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getBylawType",
        "outputs": [
          {
            "name": "bylawType",
            "type": "uint8"
          },
          {
            "name": "updated",
            "type": "uint64"
          },
          {
            "name": "updatedBy",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "voteId",
            "type": "uint256"
          },
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "castVote",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "votingIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "statusNeeded",
            "type": "uint8"
          }
        ],
        "name": "addStatusBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          },
          {
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "setEntityStatus",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "splitIntoDividends",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "stockId",
            "type": "uint8"
          },
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          }
        ],
        "name": "assignStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "entityStatus",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "saleIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getVotingBylaw",
        "outputs": [
          {
            "name": "support",
            "type": "uint256"
          },
          {
            "name": "base",
            "type": "uint256"
          },
          {
            "name": "closingRelativeMajority",
            "type": "bool"
          },
          {
            "name": "minimumVotingTime",
            "type": "uint64"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "removeRecurringReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "votingIndex",
            "type": "uint256"
          },
          {
            "name": "optionId",
            "type": "uint8"
          }
        ],
        "name": "countVotes",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "createRecurringReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "name": "stocks",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "registerIncome",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          },
          {
            "name": "_recipient",
            "type": "address"
          }
        ],
        "name": "grantStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "votings",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          },
          {
            "name": "_recipient",
            "type": "address"
          },
          {
            "name": "_cliff",
            "type": "uint64"
          },
          {
            "name": "_vesting",
            "type": "uint64"
          }
        ],
        "name": "grantVestedStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "reverseVotings",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAccountingPeriodCloses",
        "outputs": [
          {
            "name": "",
            "type": "uint64"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "stockId",
            "type": "uint8"
          },
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          }
        ],
        "name": "removeStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "sales",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "voting",
            "type": "address"
          },
          {
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "beginPoll",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "isShareholder",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "setVotingExecuted",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          }
        ],
        "name": "isStockSale",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "budget",
            "type": "uint256"
          },
          {
            "name": "periodDuration",
            "type": "uint64"
          },
          {
            "name": "dividendThreshold",
            "type": "uint256"
          }
        ],
        "name": "setAccountingSettings",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "voteExecuted",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "addTreasure",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          }
        ],
        "name": "issueStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "support",
            "type": "uint256"
          },
          {
            "name": "base",
            "type": "uint256"
          },
          {
            "name": "closingRelativeMajority",
            "type": "bool"
          },
          {
            "name": "minimumVotingTime",
            "type": "uint64"
          },
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "addVotingBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "statusNeeded",
            "type": "uint8"
          }
        ],
        "name": "addSpecialStatusBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votingAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "outcome",
            "type": "uint8"
          }
        ],
        "name": "VoteExecuted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "stockAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "IssuedStock",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "saleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "saleIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          }
        ],
        "name": "NewStockSale",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "entity",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "EntityNewStatus",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "BylawChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPeriod",
            "type": "uint256"
          }
        ],
        "name": "NewPeriod",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "closedPeriod",
            "type": "uint256"
          }
        ],
        "name": "PeriodClosed",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "NewRecurringTransaction",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "RemovedRecurringTransaction",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "period",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "TransactionSaved",
        "type": "event"
      }
    ],
    "events": {
      "0x8dcbb0568a434c369b3e9d0678a4ee476157a658fb6bbcbdb004e0f7b87c453c": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votingAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "outcome",
            "type": "uint8"
          }
        ],
        "name": "VoteExecuted",
        "type": "event"
      },
      "0xa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "stockAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "IssuedStock",
        "type": "event"
      },
      "0x9fc2cc7cc4d0a8baadda4627cf6fdfdb2e21fb3167701058da900eee4ea3011f": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "saleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "saleIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          }
        ],
        "name": "NewStockSale",
        "type": "event"
      },
      "0x21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d89": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "entity",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "EntityNewStatus",
        "type": "event"
      },
      "0x707e8cc63d34f6a1906248ce9fb061134c766bcf45438c21f6a88258f6673929": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "BylawChanged",
        "type": "event"
      },
      "0x61a611267e7ed28f8a566b021b9ac3ccc3985343a31971a180d01a57f63f3380": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPeriod",
            "type": "uint256"
          }
        ],
        "name": "NewPeriod",
        "type": "event"
      },
      "0x5263beccfd97c2947207bf7254d7c0c216431d4b9cea8c9b3371e8187020851b": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "closedPeriod",
            "type": "uint256"
          }
        ],
        "name": "PeriodClosed",
        "type": "event"
      },
      "0x959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "NewRecurringTransaction",
        "type": "event"
      },
      "0x24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e018": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "RemovedRecurringTransaction",
        "type": "event"
      },
      "0x62ad1f2c6191c79e31d5ee69f7a962dce559b92f2adf6fa27ecf13bee926a1a4": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "period",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "TransactionSaved",
        "type": "event"
      }
    },
    "updated_at": 1486032052998,
    "links": {}
  },
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "issueReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAccountingPeriodRemainingBudget",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "reverseSales",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newStock",
            "type": "address"
          },
          {
            "name": "issue",
            "type": "uint256"
          }
        ],
        "name": "addStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "stockIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_sale",
            "type": "uint256"
          }
        ],
        "name": "transferSaleFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          },
          {
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "setEntityStatusByStatus",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "saleAddress",
            "type": "address"
          }
        ],
        "name": "beginSale",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getBylawType",
        "outputs": [
          {
            "name": "bylawType",
            "type": "uint8"
          },
          {
            "name": "updated",
            "type": "uint64"
          },
          {
            "name": "updatedBy",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "voteId",
            "type": "uint256"
          },
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "castVote",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "votingIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "statusNeeded",
            "type": "uint8"
          }
        ],
        "name": "addStatusBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          },
          {
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "setEntityStatus",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "splitIntoDividends",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "stockId",
            "type": "uint8"
          },
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          }
        ],
        "name": "assignStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "entityStatus",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "saleIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getVotingBylaw",
        "outputs": [
          {
            "name": "support",
            "type": "uint256"
          },
          {
            "name": "base",
            "type": "uint256"
          },
          {
            "name": "closingRelativeMajority",
            "type": "bool"
          },
          {
            "name": "minimumVotingTime",
            "type": "uint64"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "removeRecurringReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "votingIndex",
            "type": "uint256"
          },
          {
            "name": "optionId",
            "type": "uint8"
          }
        ],
        "name": "countVotes",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "createRecurringReward",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "name": "stocks",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "registerIncome",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          },
          {
            "name": "_recipient",
            "type": "address"
          }
        ],
        "name": "grantStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "votings",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          },
          {
            "name": "_recipient",
            "type": "address"
          },
          {
            "name": "_cliff",
            "type": "uint64"
          },
          {
            "name": "_vesting",
            "type": "uint64"
          }
        ],
        "name": "grantVestedStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "reverseVotings",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAccountingPeriodCloses",
        "outputs": [
          {
            "name": "",
            "type": "uint64"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "stockId",
            "type": "uint8"
          },
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          }
        ],
        "name": "removeStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "sales",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "voting",
            "type": "address"
          },
          {
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "beginPoll",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "isShareholder",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "setVotingExecuted",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "entity",
            "type": "address"
          }
        ],
        "name": "isStockSale",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "budget",
            "type": "uint256"
          },
          {
            "name": "periodDuration",
            "type": "uint64"
          },
          {
            "name": "dividendThreshold",
            "type": "uint256"
          }
        ],
        "name": "setAccountingSettings",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "voteExecuted",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "addTreasure",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_stock",
            "type": "uint8"
          },
          {
            "name": "_amount",
            "type": "uint256"
          }
        ],
        "name": "issueStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "support",
            "type": "uint256"
          },
          {
            "name": "base",
            "type": "uint256"
          },
          {
            "name": "closingRelativeMajority",
            "type": "bool"
          },
          {
            "name": "minimumVotingTime",
            "type": "uint64"
          },
          {
            "name": "option",
            "type": "uint8"
          }
        ],
        "name": "addVotingBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          },
          {
            "name": "statusNeeded",
            "type": "uint8"
          }
        ],
        "name": "addSpecialStatusBylaw",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votingAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "outcome",
            "type": "uint8"
          }
        ],
        "name": "VoteExecuted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "stockAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "IssuedStock",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "saleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "saleIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          }
        ],
        "name": "NewStockSale",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "entity",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "EntityNewStatus",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "BylawChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPeriod",
            "type": "uint256"
          }
        ],
        "name": "NewPeriod",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "closedPeriod",
            "type": "uint256"
          }
        ],
        "name": "PeriodClosed",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "NewRecurringTransaction",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "RemovedRecurringTransaction",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "period",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "TransactionSaved",
        "type": "event"
      }
    ],
    "events": {
      "0x8dcbb0568a434c369b3e9d0678a4ee476157a658fb6bbcbdb004e0f7b87c453c": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votingAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "outcome",
            "type": "uint8"
          }
        ],
        "name": "VoteExecuted",
        "type": "event"
      },
      "0xa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "stockAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "IssuedStock",
        "type": "event"
      },
      "0x9fc2cc7cc4d0a8baadda4627cf6fdfdb2e21fb3167701058da900eee4ea3011f": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "saleAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "saleIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "stockIndex",
            "type": "uint8"
          }
        ],
        "name": "NewStockSale",
        "type": "event"
      },
      "0x21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d89": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "entity",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "status",
            "type": "uint8"
          }
        ],
        "name": "EntityNewStatus",
        "type": "event"
      },
      "0x707e8cc63d34f6a1906248ce9fb061134c766bcf45438c21f6a88258f6673929": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "BylawChanged",
        "type": "event"
      },
      "0x61a611267e7ed28f8a566b021b9ac3ccc3985343a31971a180d01a57f63f3380": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPeriod",
            "type": "uint256"
          }
        ],
        "name": "NewPeriod",
        "type": "event"
      },
      "0x5263beccfd97c2947207bf7254d7c0c216431d4b9cea8c9b3371e8187020851b": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "closedPeriod",
            "type": "uint256"
          }
        ],
        "name": "PeriodClosed",
        "type": "event"
      },
      "0x959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "NewRecurringTransaction",
        "type": "event"
      },
      "0x24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e018": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "recurringIndex",
            "type": "uint256"
          }
        ],
        "name": "RemovedRecurringTransaction",
        "type": "event"
      },
      "0x62ad1f2c6191c79e31d5ee69f7a962dce559b92f2adf6fa27ecf13bee926a1a4": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "period",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "TransactionSaved",
        "type": "event"
      }
    },
    "updated_at": 1486036778430,
    "links": {}
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "AbstractCompany";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.AbstractCompany = Contract;
  }
})();
