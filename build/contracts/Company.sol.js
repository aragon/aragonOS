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
      throw new Error("Company error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Company error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Company contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Company: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Company.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Company not deployed or address not set.");
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
            "name": "periodIndex",
            "type": "uint256"
          }
        ],
        "name": "getPeriodInfo",
        "outputs": [
          {
            "name": "lastTransaction",
            "type": "uint256"
          },
          {
            "name": "started",
            "type": "uint64"
          },
          {
            "name": "ended",
            "type": "uint64"
          },
          {
            "name": "revenue",
            "type": "uint256"
          },
          {
            "name": "expenses",
            "type": "uint256"
          },
          {
            "name": "dividends",
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
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getStatusBylaw",
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
            "name": "periodIndex",
            "type": "uint256"
          },
          {
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "getTransactionInfo",
        "outputs": [
          {
            "name": "expense",
            "type": "bool"
          },
          {
            "name": "from",
            "type": "address"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "approvedBy",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "concept",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "uint64"
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
        "inputs": [
          {
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "getRecurringTransactionInfo",
        "outputs": [
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "lastTransactionDate",
            "type": "uint64"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "approvedBy",
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
        "inputs": [],
        "name": "setInitialBylaws",
        "outputs": [],
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
        "inputs": [],
        "payable": true,
        "type": "constructor"
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
    "unlinked_binary": "0x60606040525b600160068190556009819055604080517fc1145d0d000000000000000000000000000000000000000000000000000000008152600a6004820152670de0b6b3a764000060248201526224ea00604482015260648101929092525173__AccountingLib_________________________9163c1145d0d916084808301926000929190829003018186803b15620000005760325a03f41562000000575050604080517f3405829e000000000000000000000000000000000000000000000000000000008152600a600482015260248101829052601160448201527f436f6d70616e7920626f6f7473747261700000000000000000000000000000006064820152905173__AccountingLib_________________________9250633405829e91608480820192600092909190829003018186803b15620000005760325a03f41562000000575062000167915033905060036401000000006200338f6200016e82021704565b5b620001d2565b600160a060020a03821660008181526020818152604091829020805460ff191660ff861690811790915582519384529083015280517f21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d899281900390910190a15b5050565b613f4d80620001e26000396000f300606060405236156102095763ffffffff60e060020a60003504166303e7d393811461020e57806306eb907d146102705780630782aaf11461028f57806308b02741146102ba57806311d9df49146102d85780631757f3f9146102fb578063225553a41461030d57806329552c4d1461032e5780632af2311d146103495780633aa45185146103985780634e4c2de01461041e57806356781388146104875780635dd523fa1461049f5780635fde229c146104be5780636035fa0614610518578063635a43ca1461053957806363677ff7146105435780636b87cdc4146105675780636ec012e714610596578063706d64c7146105b557806379cc2640146106375780638b06fdcf146106495780638bd138ed146106785780639052c845146106e55780639f0b8d5d14610714578063a14e3ee314610776578063a3c595c91461079a578063a598d03c146108a8578063a7e9b416146108d4578063aad0c3871461090a578063abb88cf014610935578063b2733f2014610a35578063b2f4812014610a5e578063b5f522f714610a82578063b69393f514610aae578063b89a73cb14610ad5578063c2eb438614610b02578063c5d4063114610b17578063c99ee22814610b44578063d8b1fbff14610b65578063df4406e214610b8b578063df4ceef614610b9a578063eb04f70314610bfc578063eb78bf6714610c14578063ff3a7d9114610c8f575b610000565b3461000057604080516020600460443581810135601f810184900484028501840190955284845261026e948235600160a060020a0316946024803595606494929391909201918190840183828082843750949650610ce995505050505050565b005b346100005761027d610e17565b60408051918252519081900360200190f35b346100005761027d600160a060020a0360043516610e9a565b60408051918252519081900360200190f35b346100005761026e600160a060020a0360043516602435610eac565b005b34610000576102e5611038565b6040805160ff9092168252519081900360200190f35b346100005761026e600435611041565b005b346100005761026e600160a060020a036004351660ff602435166110d9565b005b346100005761026e600160a060020a0360043516611166565b005b3461000057610359600435611308565b604080519687526001604060020a03958616602088015293909416858401526060850191909152608084015260a0830191909152519081900360c00190f35b34610000576103eb600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506113c895505050505050565b6040805160ff90941684526001604060020a039092166020840152600160a060020a031682820152519081900360600190f35b34610000576102e5600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506114a495505050505050565b6040805160ff9092168252519081900360200190f35b346100005761026e60043560ff60243516611563565b005b346100005761027d6116cb565b60408051918252519081900360200190f35b346100005761026e600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050923560ff1692506116d1915050565b005b346100005761026e600160a060020a036004351660ff602435166117a3565b005b61026e6117db565b005b346100005761026e60ff60043516600160a060020a0360243516604435611a1a565b005b34610000576102e5600160a060020a0360043516611b11565b6040805160ff9092168252519081900360200190f35b346100005761027d611b26565b60408051918252519081900360200190f35b3461000057610608600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650611b2c95505050505050565b604080519485526020850193909352901515838301526001604060020a03166060830152519081900360800190f35b346100005761026e600435611b9f565b005b346100005761065f60043560ff60243516611c44565b6040805192835260208301919091528051918290030190f35b3461000057604080516020600460643581810135601f810184900484028501840190955284845261026e948235600160a060020a03169460248035956044356001604060020a03169594608494920191908190840183828082843750949650611c6f95505050505050565b005b34610000576106f860ff60043516611dbd565b60408051600160a060020a039092168252519081900360200190f35b610762600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650611dd895505050505050565b604080519115158252519081900360200190f35b346100005761026e60ff60043516602435600160a060020a0360443516611eca565b005b34610000576107ad600435602435611f61565b604051808815151515815260200187600160a060020a0316600160a060020a0316815260200186600160a060020a0316600160a060020a0316815260200185600160a060020a0316600160a060020a0316815260200184815260200180602001836001604060020a03166001604060020a03168152602001828103825284818151815260200191508051906020019080838360008314610868575b80518252602083111561086857601f199092019160209182019101610848565b505050905090810190601f1680156108945780820380516001836020036101000a031916815260200191505b509850505050505050505060405180910390f35b34610000576106f86004356120f0565b60408051600160a060020a039092168252519081900360200190f35b346100005761026e60ff60043516602435600160a060020a03604435166001604060020a036064358116906084351661210b565b005b346100005761027d600160a060020a03600435166121db565b60408051918252519081900360200190f35b34610000576109456004356121ed565b60405180876001604060020a03166001604060020a03168152602001866001604060020a03166001604060020a0316815260200185600160a060020a0316600160a060020a0316815260200184600160a060020a0316600160a060020a03168152602001838152602001806020018281038252838181518152602001915080519060200190808383600083146109f6575b8051825260208311156109f657601f1990920191602091820191016109d6565b505050905090810190601f168015610a225780820380516001836020036101000a031916815260200191505b5097505050505050505060405180910390f35b3461000057610a42612335565b604080516001604060020a039092168252519081900360200190f35b346100005761026e60ff60043516600160a060020a03602435166044356123bb565b005b34610000576106f8600435612468565b60408051600160a060020a039092168252519081900360200190f35b346100005761026e600160a060020a03600435166001604060020a0360243516612483565b005b3461000057610762600160a060020a03600435166125a5565b604080519115158252519081900360200190f35b346100005761026e60ff60043516612651565b005b3461000057610762600160a060020a0360043516612794565b604080519115158252519081900360200190f35b346100005761026e6004356001604060020a03602435166044356127b4565b005b34610000576102e5600435612871565b6040805160ff9092168252519081900360200190f35b346100005761026e612886565b005b610762600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650612e7e95505050505050565b604080519115158252519081900360200190f35b346100005761026e60ff60043516602435612f70565b005b346100005761026e600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650508435946020810135945060408101351515935060608101356001604060020a031692506080013560ff16905061305c565b005b346100005761026e600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050923560ff16925061315a915050565b005b610d066011600160e060020a03196000351663ffffffff61322f16565b1515610d1157610000565b6040517fd5da0e71000000000000000000000000000000000000000000000000000000008152600a6004820181815260248301859052600160a060020a038616606484015260806044840190815284516084850152845173__AccountingLib_________________________9463d5da0e719493889388938b9360a4019060208601908083838215610dbe575b805182526020831115610dbe57601f199092019160209182019101610d9e565b505050905090810190601f168015610dea5780820380516001836020036101000a031916815260200191505b509550505050505060006040518083038186803b156100005760325a03f415610000575050505b5b505050565b60008073__AccountingLib_________________________6306285e56600a610e3f81613361565b6000604051604001526040518363ffffffff1660e060020a028152600401808381526020018281526020019250505060406040518083038186803b156100005760325a03f415610000575050604051519250829150505b5090565b60086020526000908152604090205481565b610ec96011600160e060020a03196000351663ffffffff61322f16565b1515610ed457610000565b30600160a060020a031682600160a060020a0316636904c94d6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f11561000057505060405151600160a060020a0316919091149050610f4957610000565b81600160a060020a031663d96831e1826040518263ffffffff1660e060020a02815260040180828152602001915050600060405180830381600087803b156100005760325a03f1156100005750506002805460ff9081166000908152600160208181526040928390208054600160a060020a031916600160a060020a038a16908117909155855460ff198116908616909301851692909217948590558251918252938316600019019092169282019290925280820184905290517fa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d92506060918190039190910190a15b5b5050565b60025460ff1681565b61105e6011600160e060020a03196000351663ffffffff61322f16565b151561106957610000565b6000818152600760205260408082205481517f3c68eb810000000000000000000000000000000000000000000000000000000081529151600160a060020a0390911692633c68eb81926004808201939182900301818387803b156100005760325a03f115610000575050505b5b50565b600160a060020a03331660009081526020819052604090205460ff80831691161161110357610000565b33600160a060020a031682600160a060020a03161415801561114d5750600160a060020a0333811660009081526020819052604080822054928516825290205460ff918216911610155b1561115757610000565b611033828261338f565b5b5050565b60006111846011600160e060020a031983351663ffffffff61322f16565b151561118f57610000565b81905030600160a060020a031681600160a060020a03166353e1ead96000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f11561000057505060405151600160a060020a031691909114905061120757610000565b6009805460009081526007602090815260408083208054600160a060020a031916600160a060020a03888116918217909255855490855260088452828520819055600181019095558151830184905281517fbaac400900000000000000000000000000000000000000000000000000000000815291517f9fc2cc7cc4d0a8baadda4627cf6fdfdb2e21fb3167701058da900eee4ea3011f95889590949288169363baac400993600480830194919391928390030190829087803b156100005760325a03f115610000575050604080518051600160a060020a039095168152602081019390935260ff909316828401525090519081900360600190a15b5b5050565b6000600060006000600060006000600a60010188815481101561000057906000526020600020906008020160005b506003810154600482015460001990910198506001604060020a0380821698509192506000680100000000000000009091049091161161138d57600681015460048201546001604060020a039081169116016113a8565b60048101546801000000000000000090046001604060020a03165b6001820154825460028401549297509550935091505b5091939550919395565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a083018490529484019190915282018190529181018290528190819061145560118663ffffffff6133f316565b90508060600151925080608001519150806040015160a001511561147857600093505b8051602001511561148857600193505b8060200151602001511561149b57600293505b5b509193909250565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a0830184905294840191909152820181905291810182905261152d60118463ffffffff6133f316565b8051602001519091501561154557805151915061155c565b8060200151602001511561155c5760208101515191505b5b50919050565b6000806115826011600160e060020a031983351663ffffffff61322f16565b151561158d57610000565b60008481526005602052604081205460ff1611156115aa57610000565b600091505b60025460ff90811690831610156116c3575060ff811660009081526001602090815260408083205481518301849052815160e060020a63b89a73cb028152600160a060020a03338116600483015292519290911693849363b89a73cb93602480850194929391928390030190829087803b156100005760325a03f115610000575050604051511590506116b757604080517fef080611000000000000000000000000000000000000000000000000000000008152600160a060020a0333811660048301526024820187905260ff8616604483015291519183169163ef0806119160648082019260009290919082900301818387803b156100005760325a03f115610000575050505b5b6001909101906115af565b5b5b50505050565b60065481565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906117619060119035600160e060020a03191661322f565b151561176c57610000565b611774613580565b9050816003811161000057815160ff909116905280516001602090910152610e118382613662565b5b5b505050565b6117c06011600160e060020a03196000351663ffffffff61322f16565b151561115757610000565b611033828261338f565b5b5b5050565b600080808080805b60025460ff90811690861610156118cf5760ff851660009081526001602090815260408083205481518301849052815160e060020a63e2d2e2190281529151600160a060020a039091169750879363e2d2e21993600480850194919392918390030190829087803b156100005760325a03f115610000575050506040518051905060ff1684600160a060020a03166318160ddd6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905002860195505b6001909401936117e3565b600092505b60025460ff9081169084161015611a115760ff831660009081526001602090815260408083205481518301849052815160e060020a63e2d2e2190281529151600160a060020a0390911695508993869363e2d2e219936004808201949293918390030190829087803b156100005760325a03f115610000575050506040518051905060ff1683600160a060020a03166318160ddd6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905002340281156100005704905081600160a060020a03166362c1e46a826040518263ffffffff1660e060020a0281526004018090506000604051808303818588803b156100005761235a5a03f11561000057505050505b6001909201916118d4565b5b505050505050565b611a376011600160e060020a03196000351663ffffffff61322f16565b1515611a4257610000565b60ff831660009081526001602052604080822054815160e060020a63d96831e1028152600481018590529151600160a060020a039091169263d96831e1926024808201939182900301818387803b156100005760325a03f1156100005750505060ff831660009081526001602052604080822054815160e060020a63c8342acb028152600160a060020a038681166004830152602482018690529251929091169263c8342acb9260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b60006020819052908152604090205460ff1681565b60095481565b6040805160c081018252600080825260208201819052918101829052606081018290526080810182905260a08101829052819081908190611b7460118763ffffffff6133f316565b604001519050806000015194508060200151935080606001519250806080015191505b509193509193565b611bbc6011600160e060020a03196000351663ffffffff61322f16565b1515611bc757610000565b604080517f69efe0f1000000000000000000000000000000000000000000000000000000008152600a600482015260248101839052905173__AccountingLib_________________________916369efe0f1916044808301926000929190829003018186803b156100005760325a03f415610000575050505b5b50565b60006000600060006000611c58878761371f565b9250925092508281945094505b5050509250929050565b611c8c6011600160e060020a03196000351663ffffffff61322f16565b1515611c9757610000565b6040517f6186d664000000000000000000000000000000000000000000000000000000008152600a6004820181815260248301869052600160a060020a03871660648401526001604060020a0385166084840152600160a4840181905260c060448501908152855160c4860152855173__AccountingLib_________________________95636186d66495948a9489948d948c9492939260e4019060208801908083838215611d61575b805182526020831115611d6157601f199092019160209182019101611d41565b505050905090810190601f168015611d8d5780820380516001836020036101000a031916815260200191505b5097505050505050505060006040518083038186803b156100005760325a03f415610000575050505b5b50505050565b600160205260009081526040902054600160a060020a031681565b604080517f8135e059000000000000000000000000000000000000000000000000000000008152600a600482018181526024830193845284516044840152845160009473__AccountingLib_________________________94638135e059949388939092916064019060208501908083838215611e70575b805182526020831115611e7057601f199092019160209182019101611e50565b505050905090810190601f168015611e9c5780820380516001836020036101000a031916815260200191505b50935050505060006040518083038186803b156100005760325a03f41561000057505050600190505b919050565b611ee76011600160e060020a03196000351663ffffffff61322f16565b1515611ef257610000565b60ff831660009081526001602052604080822054815160e060020a63c8342acb028152600160a060020a038581166004830152602482018790529251929091169263c8342acb9260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b60006000600060006000602060405190810160405280600081525060006000600a6001018a815481101561000057906000526020600020906008020160005b5060030189815481101561000057906000526020600020906006020160005b5090506001815460ff1660018111610000571497508060020160009054906101000a9004600160a060020a031696508060030160009054906101000a9004600160a060020a03169550806001015493508060050160019054906101000a9004600160a060020a031694508060050160159054906101000a90046001604060020a03169150806004018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156120db5780601f106120b0576101008083540402835291602001916120db565b820191906000526020600020905b8154815290600101906020018083116120be57829003601f168201915b505050505092505b5092959891949750929550565b600360205260009081526040902054600160a060020a031681565b6121286011600160e060020a03196000351663ffffffff61322f16565b151561213357610000565b61213d8585612f70565b60ff85166000908152600160205260408082205481517ffadbaa1b000000000000000000000000000000000000000000000000000000008152600160a060020a038781166004830152602482018990526001604060020a038088166044840152861660648301529251929091169263fadbaa1b9260848084019382900301818387803b156100005760325a03f115610000575050505b5b5050505050565b60046020526000908152604090205481565b60006000600060006000602060405190810160405280600081525060006000600a60020189815481101561000057906000526020600020906009020160005b5091508160000190508160060160009054906101000a90046001604060020a031697508060030160009054906101000a9004600160a060020a03169550806001015493508060050160019054906101000a9004600160a060020a03169450806004018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156123225780601f106122f757610100808354040283529160200191612322565b820191906000526020600020905b81548152906001019060200180831161230557829003601f168201915b505050505092505b505091939550919395565b60008073__AccountingLib_________________________6306285e56600a61235d81613361565b6000604051604001526040518363ffffffff1660e060020a028152600401808381526020018281526020019250505060406040518083038186803b156100005760325a03f415610000575050604051602001519250829150505b5090565b6123d86011600160e060020a03196000351663ffffffff61322f16565b15156123e357610000565b60ff83166000908152600160205260408082205481517f5eeb6e45000000000000000000000000000000000000000000000000000000008152600160a060020a0386811660048301526024820186905292519290911692635eeb6e459260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b600760205260009081526040902054600160a060020a031681565b6000806124a26011600160e060020a031983351663ffffffff61322f16565b15156124ad57610000565b5082905060005b60025460ff90811690821610156125575760ff81166000908152600160205260408082205460065482517fe1bf758600000000000000000000000000000000000000000000000000000000815260048101919091526001604060020a03871660248201529151600160a060020a039091169263e1bf7586926044808201939182900301818387803b156100005760325a03f115610000575050505b6001016124b4565b6006805460009081526003602090815260408083208054600160a060020a031916600160a060020a038a169081179091558454908452600490925290912081905560010190555b5b50505050565b6000805b60025460ff90811690821610156126465760ff811660009081526001602090815260408083205481518301849052815160e060020a63b89a73cb028152600160a060020a0388811660048301529251929091169363b89a73cb9360248084019491939192918390030190829087803b156100005760325a03f1156100005750506040515115905061263d576001915061155c565b5b6001016125a9565b600091505b50919050565b600160a060020a0333166000908152600460205260408120549081151561267757610000565b60008281526005602052604081205460ff16111561269457610000565b506000818152600560205260408120805460ff1916600a850160ff161790555b60025460ff90811690821610156127445760ff81166000908152600160205260408082205481517f9534e637000000000000000000000000000000000000000000000000000000008152600481018690529151600160a060020a0390911692639534e637926024808201939182900301818387803b156100005760325a03f115610000575050505b6001016126b4565b60408051838152600160a060020a033316602082015260ff85168183015290517f8dcbb0568a434c369b3e9d0678a4ee476157a658fb6bbcbdb004e0f7b87c453c9181900360600190a15b505050565b600160a060020a038116600090815260086020526040812054115b919050565b6127d16011600160e060020a03196000351663ffffffff61322f16565b15156127dc57610000565b604080517fc608c59d000000000000000000000000000000000000000000000000000000008152600a6004820152602481018590526001604060020a038416604482015260648101839052905173__AccountingLib_________________________9163c608c59d916084808301926000929190829003018186803b156100005760325a03f415610000575050505b5b505050565b60056020526000908152604090205460ff1681565b60408051808201909152601e81527f736574456e7469747953746174757328616464726573732c75696e7438290000602082015260009062093a80906128d2906001600281858761305c565b612913604060405190810160405280601981526020017f626567696e506f6c6c28616464726573732c75696e7436342900000000000000815250600061315a565b612954604060405190810160405280601781526020017f63617374566f74652875696e743235362c75696e743829000000000000000000815250600061315a565b61299b604060405190810160405280601981526020017f61646453746f636b28616464726573732c75696e743235362900000000000000815250600160026001858761305c565b6129e2604060405190810160405280601981526020017f697373756553746f636b2875696e74382c75696e743235362900000000000000815250600160026001858761305c565b612a49606060405190810160405280602181526020017f6772616e7453746f636b2875696e74382c75696e743235362c6164647265737381526020017f290000000000000000000000000000000000000000000000000000000000000081525060026116d1565b612ab6606060405190810160405280603581526020017f6772616e7456657374656453746f636b2875696e74382c75696e743235362c6181526020017f6464726573732c75696e7436342c75696e743634290000000000000000000000815250600160026001858761305c565b612afd604060405190810160405280601281526020017f626567696e53616c652861646472657373290000000000000000000000000000815250600160026001858761305c565b612b3e604060405190810160405280601a81526020017f7472616e7366657253616c6546756e64732875696e743235362900000000000081525060026116d1565b612b8d606060405190810160405280602281526020017f61737369676e53746f636b2875696e74382c616464726573732c75696e743235815260200160f060020a61362902815250600161315a565b612bdc606060405190810160405280602281526020017f72656d6f766553746f636b2875696e74382c616464726573732c75696e743235815260200160f060020a61362902815250600161315a565b612c49606060405190810160405280602d81526020017f7365744163636f756e74696e6753657474696e67732875696e743235362c756981526020017f6e7436342c75696e743235362900000000000000000000000000000000000000815250600160026001858761305c565b612cb0606060405190810160405280603481526020017f637265617465526563757272696e6752657761726428616464726573732c756981526020017f6e743235362c75696e7436342c737472696e672900000000000000000000000081525060026116d1565b612cf1604060405190810160405280601b81526020017f72656d6f7665526563757272696e675265776172642875696e7429000000000081525060026116d1565b612d58606060405190810160405280602381526020017f697373756552657761726428616464726573732c75696e743235362c7374726981526020017f6e6729000000000000000000000000000000000000000000000000000000000081525060026116d1565b612d9f604060405190810160405280601c81526020017f61646453746174757342796c617728737472696e672c75696e74382900000000815250600260036000858761305c565b612e0c606060405190810160405280602381526020017f6164645370656369616c53746174757342796c617728737472696e672c75696e81526020017f7438290000000000000000000000000000000000000000000000000000000000815250600260036000858761305c565b611033606060405190810160405280603881526020017f616464566f74696e6742796c617728737472696e672c75696e743235362c756981526020017f6e743235362c626f6f6c2c75696e7436342c75696e7438290000000000000000815250600260036000858761305c565b5b5050565b604080517f3405829e000000000000000000000000000000000000000000000000000000008152600a600482018181526024830193845284516044840152845160009473__AccountingLib_________________________94633405829e949388939092916064019060208501908083838215611e70575b805182526020831115611e7057601f199092019160209182019101611e50565b505050905090810190601f168015611e9c5780820380516001836020036101000a031916815260200191505b50935050505060006040518083038186803b156100005760325a03f41561000057505050600190505b919050565b612f8d6011600160e060020a03196000351663ffffffff61322f16565b1515612f9857610000565b60ff821660009081526001602052604080822054815160e060020a63d96831e1028152600481018590529151600160a060020a039091169263d96831e1926024808201939182900301818387803b156100005760325a03f1156100005750505060ff8216600081815260016020908152604091829020548251600160a060020a03909116815290810192909252818101839052517fa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d9181900360600190a15b5b5050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906130ec9060119035600160e060020a03191661322f565b15156130f757610000565b6130ff613580565b604080820180518990528051602001889052805187151560609091015280516001604060020a038716608090910152805160ff861692019190915251600160a090910152905061314f8782613662565b5b5b50505050505050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906131ea9060119035600160e060020a03191661322f565b15156131f557610000565b6131fd613580565b90508160018111610000576020808301805160ff90931690925290516001910152610e118382613662565b5b5b505050565b600160e060020a03198116600090815260208390526040812060058101546001604060020a0316151561327357805461010060ff1990911660021761ff0019161781555b8054610100900460ff161561329c57805460ff1661329033613945565b60ff161015915061335a565b6001810154610100900460ff16156132c85760018101546132c190339060ff166139bd565b915061335a565b6004810154605060020a900460ff1615613354576040805160c0810182526002830154815260038301546020820152600483015460ff8082169383019390935261010081048316151560608301526001604060020a03620100008204166080830152605060020a9004909116151560a0820152613346903390613ae5565b15613354576001915061335a565b5b600091505b5092915050565b6000816001018260030154815481101561000057906000526020600020906008020160005b5090505b919050565b600160a060020a03821660008181526020818152604091829020805460ff191660ff861690811790915582519384529083015280517f21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d899281900390910190a15b5050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a0830184905294840191909152820181905291810182905290839061347784613d3b565b600160e060020a03191681526020808201929092526040908101600020815160e081018352815460ff80821660a0808501918252610100938490048316151560c080870191909152918552865180880188526001870154808516825285900484161515818a0152858901528651918201875260028601548252600386015497820197909752600485015480831682880152928304821615156060828101919091526201000084046001604060020a03908116608084810191909152605060020a909504909316151597820197909752948301949094526005909201549283169381019390935268010000000000000000909104600160a060020a03169082015290505b92915050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c081810186528382528183018490528186018490526060808301859052608080840186905260a080850187905287890194909452818701869052958601859052865160e081018852808401868152818401879052815287518089018952868152808601879052818601528751928301885285835293820185905281870185905281810185905281860185905291810184905294820194909452928301819052908201525b90565b6136746011838363ffffffff613da216565b7f707e8cc63d34f6a1906248ce9fb061134c766bcf45438c21f6a88258f66739298260405180806020018281038252838181518152602001915080519060200190808383600083146136e1575b8051825260208311156136e157601f1990920191602091820191016136c1565b505050905090810190601f16801561370d5780820380516001836020036101000a031916815260200191505b509250505060405180910390a15b5050565b6000808080805b30600160a060020a03166311d9df496000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905060ff168260ff16101561393b5730600160a060020a0316639052c845836000604051602001526040518263ffffffff1660e060020a028152600401808260ff1660ff168152602001915050602060405180830381600087803b156100005760325a03f1156100005750506040805180516000602092830181905283517faf5e84be000000000000000000000000000000000000000000000000000000008152600481018d905260ff8c1660248201529351919550600160a060020a038616945063af5e84be936044808201949392918390030190829087803b156100005760325a03f11561000057505050604051805190508501945080600160a060020a0316637c4d6771886000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f11561000057505050604051805190508401935080600160a060020a031663671b37936000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050604051519390930192505b600190910190613726565b5b50509250925092565b600030600160a060020a0316636b87cdc4336000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f115610000575050604051519150505b919050565b600060008260ff166001811161000057905060008160018111610000571415613a565730600160a060020a031663b89a73cb856000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151925061335a9050565b6001816001811161000057141561335a5730600160a060020a031663c5d40631856000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151925061335a9050565b5b5092915050565b600060006000600060006000600030600160a060020a031663aad0c3878a6000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151965050851515613b735760009650613d2f565b600030600160a060020a031663d8b1fbff886000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f115610000575050506040518051905060ff161115613be65760009650613d2f565b613bf486896040015161371f565b94509450945087602001518860000151840281156100005704915081851015613d295787606001511515613c2b5760009650613d2f565b30600160a060020a0316639052c84560006000604051602001526040518263ffffffff1660e060020a028152600401808260ff168152602001915050602060405180830381600087803b156100005760325a03f1156100005750505060405180519050600160a060020a031663359f6b1a876000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f115610000575050604051516001604060020a03169150504281901015613d065760009650613d2f565b60208801518851850281156100005704915081851015613d295760009650613d2f565b5b600196505b50505050505092915050565b6000816040518082805190602001908083835b60208310613d6d5780518252601f199092019160209182019101613d4e565b6001836020036101000a038019825116818451168082178552505050505050905001915050604051809103902090505b919050565b6000613dad83613d3b565b600160e060020a031981166000908152602086815260409182902085518051825491840151151561010090810261ff001960ff93841660ff19958616178116919091178555858a015180516001870180549289015115158502918616928716929092178316179055868a015180516002870155958601516003860155958501516004850180546060808901516080808b015160a0909b01511515605060020a026aff00000000000000000000196001604060020a039c8d16620100000269ffffffffffffffff000019941515909902979099169490991693909317909a169390931798909816929092179290921692909217909155860151600590910180549387015133600160a060020a039081166801000000000000000090810242871692909316027fffffffff0000000000000000000000000000000000000000ffffffffffffffff9490951667ffffffffffffffff1996871617841694909417909416929092171691909117905590505b505050505600a165627a7a72305820515c2c05c04a38bc20dc7f2693351a3e3d5bb362a6ad7f812529df0e1100fd160029",
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
    "updated_at": 1486123801962,
    "links": {
      "AccountingLib": "0x7ec2ec99fa117aa2fac791563958952449073d41",
      "BylawsLib": "0xbe73227fb7c1df30cb8848ff67aaab503fc6acde"
    },
    "address": "0x44dce125d4cb438080fe081f699fa2d003fa76b0"
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
            "name": "periodIndex",
            "type": "uint256"
          }
        ],
        "name": "getPeriodInfo",
        "outputs": [
          {
            "name": "lastTransaction",
            "type": "uint256"
          },
          {
            "name": "started",
            "type": "uint64"
          },
          {
            "name": "ended",
            "type": "uint64"
          },
          {
            "name": "revenue",
            "type": "uint256"
          },
          {
            "name": "expenses",
            "type": "uint256"
          },
          {
            "name": "dividends",
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
        "constant": true,
        "inputs": [
          {
            "name": "functionSignature",
            "type": "string"
          }
        ],
        "name": "getStatusBylaw",
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
            "name": "periodIndex",
            "type": "uint256"
          },
          {
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "getTransactionInfo",
        "outputs": [
          {
            "name": "expense",
            "type": "bool"
          },
          {
            "name": "from",
            "type": "address"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "approvedBy",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          },
          {
            "name": "concept",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "uint64"
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
        "inputs": [
          {
            "name": "transactionIndex",
            "type": "uint256"
          }
        ],
        "name": "getRecurringTransactionInfo",
        "outputs": [
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "lastTransactionDate",
            "type": "uint64"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "approvedBy",
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
        "inputs": [],
        "name": "setInitialBylaws",
        "outputs": [],
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
        "inputs": [],
        "payable": true,
        "type": "constructor"
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
    "unlinked_binary": "0x60606040525b600160068190556009819055604080517fc1145d0d000000000000000000000000000000000000000000000000000000008152600a6004820152670de0b6b3a764000060248201526224ea00604482015260648101929092525173__AccountingLib_________________________9163c1145d0d916084808301926000929190829003018186803b15620000005760325a03f41562000000575050604080517f3405829e000000000000000000000000000000000000000000000000000000008152600a600482015260248101829052601160448201527f436f6d70616e7920626f6f7473747261700000000000000000000000000000006064820152905173__AccountingLib_________________________9250633405829e91608480820192600092909190829003018186803b15620000005760325a03f41562000000575062000167915033905060036401000000006200338f6200016e82021704565b5b620001d2565b600160a060020a03821660008181526020818152604091829020805460ff191660ff861690811790915582519384529083015280517f21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d899281900390910190a15b5050565b613f4d80620001e26000396000f300606060405236156102095763ffffffff60e060020a60003504166303e7d393811461020e57806306eb907d146102705780630782aaf11461028f57806308b02741146102ba57806311d9df49146102d85780631757f3f9146102fb578063225553a41461030d57806329552c4d1461032e5780632af2311d146103495780633aa45185146103985780634e4c2de01461041e57806356781388146104875780635dd523fa1461049f5780635fde229c146104be5780636035fa0614610518578063635a43ca1461053957806363677ff7146105435780636b87cdc4146105675780636ec012e714610596578063706d64c7146105b557806379cc2640146106375780638b06fdcf146106495780638bd138ed146106785780639052c845146106e55780639f0b8d5d14610714578063a14e3ee314610776578063a3c595c91461079a578063a598d03c146108a8578063a7e9b416146108d4578063aad0c3871461090a578063abb88cf014610935578063b2733f2014610a35578063b2f4812014610a5e578063b5f522f714610a82578063b69393f514610aae578063b89a73cb14610ad5578063c2eb438614610b02578063c5d4063114610b17578063c99ee22814610b44578063d8b1fbff14610b65578063df4406e214610b8b578063df4ceef614610b9a578063eb04f70314610bfc578063eb78bf6714610c14578063ff3a7d9114610c8f575b610000565b3461000057604080516020600460443581810135601f810184900484028501840190955284845261026e948235600160a060020a0316946024803595606494929391909201918190840183828082843750949650610ce995505050505050565b005b346100005761027d610e17565b60408051918252519081900360200190f35b346100005761027d600160a060020a0360043516610e9a565b60408051918252519081900360200190f35b346100005761026e600160a060020a0360043516602435610eac565b005b34610000576102e5611038565b6040805160ff9092168252519081900360200190f35b346100005761026e600435611041565b005b346100005761026e600160a060020a036004351660ff602435166110d9565b005b346100005761026e600160a060020a0360043516611166565b005b3461000057610359600435611308565b604080519687526001604060020a03958616602088015293909416858401526060850191909152608084015260a0830191909152519081900360c00190f35b34610000576103eb600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506113c895505050505050565b6040805160ff90941684526001604060020a039092166020840152600160a060020a031682820152519081900360600190f35b34610000576102e5600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506114a495505050505050565b6040805160ff9092168252519081900360200190f35b346100005761026e60043560ff60243516611563565b005b346100005761027d6116cb565b60408051918252519081900360200190f35b346100005761026e600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050923560ff1692506116d1915050565b005b346100005761026e600160a060020a036004351660ff602435166117a3565b005b61026e6117db565b005b346100005761026e60ff60043516600160a060020a0360243516604435611a1a565b005b34610000576102e5600160a060020a0360043516611b11565b6040805160ff9092168252519081900360200190f35b346100005761027d611b26565b60408051918252519081900360200190f35b3461000057610608600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650611b2c95505050505050565b604080519485526020850193909352901515838301526001604060020a03166060830152519081900360800190f35b346100005761026e600435611b9f565b005b346100005761065f60043560ff60243516611c44565b6040805192835260208301919091528051918290030190f35b3461000057604080516020600460643581810135601f810184900484028501840190955284845261026e948235600160a060020a03169460248035956044356001604060020a03169594608494920191908190840183828082843750949650611c6f95505050505050565b005b34610000576106f860ff60043516611dbd565b60408051600160a060020a039092168252519081900360200190f35b610762600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650611dd895505050505050565b604080519115158252519081900360200190f35b346100005761026e60ff60043516602435600160a060020a0360443516611eca565b005b34610000576107ad600435602435611f61565b604051808815151515815260200187600160a060020a0316600160a060020a0316815260200186600160a060020a0316600160a060020a0316815260200185600160a060020a0316600160a060020a0316815260200184815260200180602001836001604060020a03166001604060020a03168152602001828103825284818151815260200191508051906020019080838360008314610868575b80518252602083111561086857601f199092019160209182019101610848565b505050905090810190601f1680156108945780820380516001836020036101000a031916815260200191505b509850505050505050505060405180910390f35b34610000576106f86004356120f0565b60408051600160a060020a039092168252519081900360200190f35b346100005761026e60ff60043516602435600160a060020a03604435166001604060020a036064358116906084351661210b565b005b346100005761027d600160a060020a03600435166121db565b60408051918252519081900360200190f35b34610000576109456004356121ed565b60405180876001604060020a03166001604060020a03168152602001866001604060020a03166001604060020a0316815260200185600160a060020a0316600160a060020a0316815260200184600160a060020a0316600160a060020a03168152602001838152602001806020018281038252838181518152602001915080519060200190808383600083146109f6575b8051825260208311156109f657601f1990920191602091820191016109d6565b505050905090810190601f168015610a225780820380516001836020036101000a031916815260200191505b5097505050505050505060405180910390f35b3461000057610a42612335565b604080516001604060020a039092168252519081900360200190f35b346100005761026e60ff60043516600160a060020a03602435166044356123bb565b005b34610000576106f8600435612468565b60408051600160a060020a039092168252519081900360200190f35b346100005761026e600160a060020a03600435166001604060020a0360243516612483565b005b3461000057610762600160a060020a03600435166125a5565b604080519115158252519081900360200190f35b346100005761026e60ff60043516612651565b005b3461000057610762600160a060020a0360043516612794565b604080519115158252519081900360200190f35b346100005761026e6004356001604060020a03602435166044356127b4565b005b34610000576102e5600435612871565b6040805160ff9092168252519081900360200190f35b346100005761026e612886565b005b610762600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650612e7e95505050505050565b604080519115158252519081900360200190f35b346100005761026e60ff60043516602435612f70565b005b346100005761026e600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650508435946020810135945060408101351515935060608101356001604060020a031692506080013560ff16905061305c565b005b346100005761026e600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050923560ff16925061315a915050565b005b610d066011600160e060020a03196000351663ffffffff61322f16565b1515610d1157610000565b6040517fd5da0e71000000000000000000000000000000000000000000000000000000008152600a6004820181815260248301859052600160a060020a038616606484015260806044840190815284516084850152845173__AccountingLib_________________________9463d5da0e719493889388938b9360a4019060208601908083838215610dbe575b805182526020831115610dbe57601f199092019160209182019101610d9e565b505050905090810190601f168015610dea5780820380516001836020036101000a031916815260200191505b509550505050505060006040518083038186803b156100005760325a03f415610000575050505b5b505050565b60008073__AccountingLib_________________________6306285e56600a610e3f81613361565b6000604051604001526040518363ffffffff1660e060020a028152600401808381526020018281526020019250505060406040518083038186803b156100005760325a03f415610000575050604051519250829150505b5090565b60086020526000908152604090205481565b610ec96011600160e060020a03196000351663ffffffff61322f16565b1515610ed457610000565b30600160a060020a031682600160a060020a0316636904c94d6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f11561000057505060405151600160a060020a0316919091149050610f4957610000565b81600160a060020a031663d96831e1826040518263ffffffff1660e060020a02815260040180828152602001915050600060405180830381600087803b156100005760325a03f1156100005750506002805460ff9081166000908152600160208181526040928390208054600160a060020a031916600160a060020a038a16908117909155855460ff198116908616909301851692909217948590558251918252938316600019019092169282019290925280820184905290517fa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d92506060918190039190910190a15b5b5050565b60025460ff1681565b61105e6011600160e060020a03196000351663ffffffff61322f16565b151561106957610000565b6000818152600760205260408082205481517f3c68eb810000000000000000000000000000000000000000000000000000000081529151600160a060020a0390911692633c68eb81926004808201939182900301818387803b156100005760325a03f115610000575050505b5b50565b600160a060020a03331660009081526020819052604090205460ff80831691161161110357610000565b33600160a060020a031682600160a060020a03161415801561114d5750600160a060020a0333811660009081526020819052604080822054928516825290205460ff918216911610155b1561115757610000565b611033828261338f565b5b5050565b60006111846011600160e060020a031983351663ffffffff61322f16565b151561118f57610000565b81905030600160a060020a031681600160a060020a03166353e1ead96000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f11561000057505060405151600160a060020a031691909114905061120757610000565b6009805460009081526007602090815260408083208054600160a060020a031916600160a060020a03888116918217909255855490855260088452828520819055600181019095558151830184905281517fbaac400900000000000000000000000000000000000000000000000000000000815291517f9fc2cc7cc4d0a8baadda4627cf6fdfdb2e21fb3167701058da900eee4ea3011f95889590949288169363baac400993600480830194919391928390030190829087803b156100005760325a03f115610000575050604080518051600160a060020a039095168152602081019390935260ff909316828401525090519081900360600190a15b5b5050565b6000600060006000600060006000600a60010188815481101561000057906000526020600020906008020160005b506003810154600482015460001990910198506001604060020a0380821698509192506000680100000000000000009091049091161161138d57600681015460048201546001604060020a039081169116016113a8565b60048101546801000000000000000090046001604060020a03165b6001820154825460028401549297509550935091505b5091939550919395565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a083018490529484019190915282018190529181018290528190819061145560118663ffffffff6133f316565b90508060600151925080608001519150806040015160a001511561147857600093505b8051602001511561148857600193505b8060200151602001511561149b57600293505b5b509193909250565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a0830184905294840191909152820181905291810182905261152d60118463ffffffff6133f316565b8051602001519091501561154557805151915061155c565b8060200151602001511561155c5760208101515191505b5b50919050565b6000806115826011600160e060020a031983351663ffffffff61322f16565b151561158d57610000565b60008481526005602052604081205460ff1611156115aa57610000565b600091505b60025460ff90811690831610156116c3575060ff811660009081526001602090815260408083205481518301849052815160e060020a63b89a73cb028152600160a060020a03338116600483015292519290911693849363b89a73cb93602480850194929391928390030190829087803b156100005760325a03f115610000575050604051511590506116b757604080517fef080611000000000000000000000000000000000000000000000000000000008152600160a060020a0333811660048301526024820187905260ff8616604483015291519183169163ef0806119160648082019260009290919082900301818387803b156100005760325a03f115610000575050505b5b6001909101906115af565b5b5b50505050565b60065481565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906117619060119035600160e060020a03191661322f565b151561176c57610000565b611774613580565b9050816003811161000057815160ff909116905280516001602090910152610e118382613662565b5b5b505050565b6117c06011600160e060020a03196000351663ffffffff61322f16565b151561115757610000565b611033828261338f565b5b5b5050565b600080808080805b60025460ff90811690861610156118cf5760ff851660009081526001602090815260408083205481518301849052815160e060020a63e2d2e2190281529151600160a060020a039091169750879363e2d2e21993600480850194919392918390030190829087803b156100005760325a03f115610000575050506040518051905060ff1684600160a060020a03166318160ddd6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905002860195505b6001909401936117e3565b600092505b60025460ff9081169084161015611a115760ff831660009081526001602090815260408083205481518301849052815160e060020a63e2d2e2190281529151600160a060020a0390911695508993869363e2d2e219936004808201949293918390030190829087803b156100005760325a03f115610000575050506040518051905060ff1683600160a060020a03166318160ddd6000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905002340281156100005704905081600160a060020a03166362c1e46a826040518263ffffffff1660e060020a0281526004018090506000604051808303818588803b156100005761235a5a03f11561000057505050505b6001909201916118d4565b5b505050505050565b611a376011600160e060020a03196000351663ffffffff61322f16565b1515611a4257610000565b60ff831660009081526001602052604080822054815160e060020a63d96831e1028152600481018590529151600160a060020a039091169263d96831e1926024808201939182900301818387803b156100005760325a03f1156100005750505060ff831660009081526001602052604080822054815160e060020a63c8342acb028152600160a060020a038681166004830152602482018690529251929091169263c8342acb9260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b60006020819052908152604090205460ff1681565b60095481565b6040805160c081018252600080825260208201819052918101829052606081018290526080810182905260a08101829052819081908190611b7460118763ffffffff6133f316565b604001519050806000015194508060200151935080606001519250806080015191505b509193509193565b611bbc6011600160e060020a03196000351663ffffffff61322f16565b1515611bc757610000565b604080517f69efe0f1000000000000000000000000000000000000000000000000000000008152600a600482015260248101839052905173__AccountingLib_________________________916369efe0f1916044808301926000929190829003018186803b156100005760325a03f415610000575050505b5b50565b60006000600060006000611c58878761371f565b9250925092508281945094505b5050509250929050565b611c8c6011600160e060020a03196000351663ffffffff61322f16565b1515611c9757610000565b6040517f6186d664000000000000000000000000000000000000000000000000000000008152600a6004820181815260248301869052600160a060020a03871660648401526001604060020a0385166084840152600160a4840181905260c060448501908152855160c4860152855173__AccountingLib_________________________95636186d66495948a9489948d948c9492939260e4019060208801908083838215611d61575b805182526020831115611d6157601f199092019160209182019101611d41565b505050905090810190601f168015611d8d5780820380516001836020036101000a031916815260200191505b5097505050505050505060006040518083038186803b156100005760325a03f415610000575050505b5b50505050565b600160205260009081526040902054600160a060020a031681565b604080517f8135e059000000000000000000000000000000000000000000000000000000008152600a600482018181526024830193845284516044840152845160009473__AccountingLib_________________________94638135e059949388939092916064019060208501908083838215611e70575b805182526020831115611e7057601f199092019160209182019101611e50565b505050905090810190601f168015611e9c5780820380516001836020036101000a031916815260200191505b50935050505060006040518083038186803b156100005760325a03f41561000057505050600190505b919050565b611ee76011600160e060020a03196000351663ffffffff61322f16565b1515611ef257610000565b60ff831660009081526001602052604080822054815160e060020a63c8342acb028152600160a060020a038581166004830152602482018790529251929091169263c8342acb9260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b60006000600060006000602060405190810160405280600081525060006000600a6001018a815481101561000057906000526020600020906008020160005b5060030189815481101561000057906000526020600020906006020160005b5090506001815460ff1660018111610000571497508060020160009054906101000a9004600160a060020a031696508060030160009054906101000a9004600160a060020a03169550806001015493508060050160019054906101000a9004600160a060020a031694508060050160159054906101000a90046001604060020a03169150806004018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156120db5780601f106120b0576101008083540402835291602001916120db565b820191906000526020600020905b8154815290600101906020018083116120be57829003601f168201915b505050505092505b5092959891949750929550565b600360205260009081526040902054600160a060020a031681565b6121286011600160e060020a03196000351663ffffffff61322f16565b151561213357610000565b61213d8585612f70565b60ff85166000908152600160205260408082205481517ffadbaa1b000000000000000000000000000000000000000000000000000000008152600160a060020a038781166004830152602482018990526001604060020a038088166044840152861660648301529251929091169263fadbaa1b9260848084019382900301818387803b156100005760325a03f115610000575050505b5b5050505050565b60046020526000908152604090205481565b60006000600060006000602060405190810160405280600081525060006000600a60020189815481101561000057906000526020600020906009020160005b5091508160000190508160060160009054906101000a90046001604060020a031697508060030160009054906101000a9004600160a060020a03169550806001015493508060050160019054906101000a9004600160a060020a03169450806004018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156123225780601f106122f757610100808354040283529160200191612322565b820191906000526020600020905b81548152906001019060200180831161230557829003601f168201915b505050505092505b505091939550919395565b60008073__AccountingLib_________________________6306285e56600a61235d81613361565b6000604051604001526040518363ffffffff1660e060020a028152600401808381526020018281526020019250505060406040518083038186803b156100005760325a03f415610000575050604051602001519250829150505b5090565b6123d86011600160e060020a03196000351663ffffffff61322f16565b15156123e357610000565b60ff83166000908152600160205260408082205481517f5eeb6e45000000000000000000000000000000000000000000000000000000008152600160a060020a0386811660048301526024820186905292519290911692635eeb6e459260448084019382900301818387803b156100005760325a03f115610000575050505b5b505050565b600760205260009081526040902054600160a060020a031681565b6000806124a26011600160e060020a031983351663ffffffff61322f16565b15156124ad57610000565b5082905060005b60025460ff90811690821610156125575760ff81166000908152600160205260408082205460065482517fe1bf758600000000000000000000000000000000000000000000000000000000815260048101919091526001604060020a03871660248201529151600160a060020a039091169263e1bf7586926044808201939182900301818387803b156100005760325a03f115610000575050505b6001016124b4565b6006805460009081526003602090815260408083208054600160a060020a031916600160a060020a038a169081179091558454908452600490925290912081905560010190555b5b50505050565b6000805b60025460ff90811690821610156126465760ff811660009081526001602090815260408083205481518301849052815160e060020a63b89a73cb028152600160a060020a0388811660048301529251929091169363b89a73cb9360248084019491939192918390030190829087803b156100005760325a03f1156100005750506040515115905061263d576001915061155c565b5b6001016125a9565b600091505b50919050565b600160a060020a0333166000908152600460205260408120549081151561267757610000565b60008281526005602052604081205460ff16111561269457610000565b506000818152600560205260408120805460ff1916600a850160ff161790555b60025460ff90811690821610156127445760ff81166000908152600160205260408082205481517f9534e637000000000000000000000000000000000000000000000000000000008152600481018690529151600160a060020a0390911692639534e637926024808201939182900301818387803b156100005760325a03f115610000575050505b6001016126b4565b60408051838152600160a060020a033316602082015260ff85168183015290517f8dcbb0568a434c369b3e9d0678a4ee476157a658fb6bbcbdb004e0f7b87c453c9181900360600190a15b505050565b600160a060020a038116600090815260086020526040812054115b919050565b6127d16011600160e060020a03196000351663ffffffff61322f16565b15156127dc57610000565b604080517fc608c59d000000000000000000000000000000000000000000000000000000008152600a6004820152602481018590526001604060020a038416604482015260648101839052905173__AccountingLib_________________________9163c608c59d916084808301926000929190829003018186803b156100005760325a03f415610000575050505b5b505050565b60056020526000908152604090205460ff1681565b60408051808201909152601e81527f736574456e7469747953746174757328616464726573732c75696e7438290000602082015260009062093a80906128d2906001600281858761305c565b612913604060405190810160405280601981526020017f626567696e506f6c6c28616464726573732c75696e7436342900000000000000815250600061315a565b612954604060405190810160405280601781526020017f63617374566f74652875696e743235362c75696e743829000000000000000000815250600061315a565b61299b604060405190810160405280601981526020017f61646453746f636b28616464726573732c75696e743235362900000000000000815250600160026001858761305c565b6129e2604060405190810160405280601981526020017f697373756553746f636b2875696e74382c75696e743235362900000000000000815250600160026001858761305c565b612a49606060405190810160405280602181526020017f6772616e7453746f636b2875696e74382c75696e743235362c6164647265737381526020017f290000000000000000000000000000000000000000000000000000000000000081525060026116d1565b612ab6606060405190810160405280603581526020017f6772616e7456657374656453746f636b2875696e74382c75696e743235362c6181526020017f6464726573732c75696e7436342c75696e743634290000000000000000000000815250600160026001858761305c565b612afd604060405190810160405280601281526020017f626567696e53616c652861646472657373290000000000000000000000000000815250600160026001858761305c565b612b3e604060405190810160405280601a81526020017f7472616e7366657253616c6546756e64732875696e743235362900000000000081525060026116d1565b612b8d606060405190810160405280602281526020017f61737369676e53746f636b2875696e74382c616464726573732c75696e743235815260200160f060020a61362902815250600161315a565b612bdc606060405190810160405280602281526020017f72656d6f766553746f636b2875696e74382c616464726573732c75696e743235815260200160f060020a61362902815250600161315a565b612c49606060405190810160405280602d81526020017f7365744163636f756e74696e6753657474696e67732875696e743235362c756981526020017f6e7436342c75696e743235362900000000000000000000000000000000000000815250600160026001858761305c565b612cb0606060405190810160405280603481526020017f637265617465526563757272696e6752657761726428616464726573732c756981526020017f6e743235362c75696e7436342c737472696e672900000000000000000000000081525060026116d1565b612cf1604060405190810160405280601b81526020017f72656d6f7665526563757272696e675265776172642875696e7429000000000081525060026116d1565b612d58606060405190810160405280602381526020017f697373756552657761726428616464726573732c75696e743235362c7374726981526020017f6e6729000000000000000000000000000000000000000000000000000000000081525060026116d1565b612d9f604060405190810160405280601c81526020017f61646453746174757342796c617728737472696e672c75696e74382900000000815250600260036000858761305c565b612e0c606060405190810160405280602381526020017f6164645370656369616c53746174757342796c617728737472696e672c75696e81526020017f7438290000000000000000000000000000000000000000000000000000000000815250600260036000858761305c565b611033606060405190810160405280603881526020017f616464566f74696e6742796c617728737472696e672c75696e743235362c756981526020017f6e743235362c626f6f6c2c75696e7436342c75696e7438290000000000000000815250600260036000858761305c565b5b5050565b604080517f3405829e000000000000000000000000000000000000000000000000000000008152600a600482018181526024830193845284516044840152845160009473__AccountingLib_________________________94633405829e949388939092916064019060208501908083838215611e70575b805182526020831115611e7057601f199092019160209182019101611e50565b505050905090810190601f168015611e9c5780820380516001836020036101000a031916815260200191505b50935050505060006040518083038186803b156100005760325a03f41561000057505050600190505b919050565b612f8d6011600160e060020a03196000351663ffffffff61322f16565b1515612f9857610000565b60ff821660009081526001602052604080822054815160e060020a63d96831e1028152600481018590529151600160a060020a039091169263d96831e1926024808201939182900301818387803b156100005760325a03f1156100005750505060ff8216600081815260016020908152604091829020548251600160a060020a03909116815290810192909252818101839052517fa57e55b329840b29f230f9984829ca4a7881db8c26a41a8140955db70b6cc15d9181900360600190a15b5b5050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906130ec9060119035600160e060020a03191661322f565b15156130f757610000565b6130ff613580565b604080820180518990528051602001889052805187151560609091015280516001604060020a038716608090910152805160ff861692019190915251600160a090910152905061314f8782613662565b5b5b50505050505050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602080820183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a08301849052948401919091528201819052918101829052906131ea9060119035600160e060020a03191661322f565b15156131f557610000565b6131fd613580565b90508160018111610000576020808301805160ff90931690925290516001910152610e118382613662565b5b5b505050565b600160e060020a03198116600090815260208390526040812060058101546001604060020a0316151561327357805461010060ff1990911660021761ff0019161781555b8054610100900460ff161561329c57805460ff1661329033613945565b60ff161015915061335a565b6001810154610100900460ff16156132c85760018101546132c190339060ff166139bd565b915061335a565b6004810154605060020a900460ff1615613354576040805160c0810182526002830154815260038301546020820152600483015460ff8082169383019390935261010081048316151560608301526001604060020a03620100008204166080830152605060020a9004909116151560a0820152613346903390613ae5565b15613354576001915061335a565b5b600091505b5092915050565b6000816001018260030154815481101561000057906000526020600020906008020160005b5090505b919050565b600160a060020a03821660008181526020818152604091829020805460ff191660ff861690811790915582519384529083015280517f21035d17ebab4a65c22f9da200bc402d7168367cfd00f68d3a8ce8b6a6433d899281900390910190a15b5050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c0810185528281529081018290528084018290526060808201839052608080830184905260a0830184905294840191909152820181905291810182905290839061347784613d3b565b600160e060020a03191681526020808201929092526040908101600020815160e081018352815460ff80821660a0808501918252610100938490048316151560c080870191909152918552865180880188526001870154808516825285900484161515818a0152858901528651918201875260028601548252600386015497820197909752600485015480831682880152928304821615156060828101919091526201000084046001604060020a03908116608084810191909152605060020a909504909316151597820197909752948301949094526005909201549283169381019390935268010000000000000000909104600160a060020a03169082015290505b92915050565b604080516101c081018252600061018082018181526101a08301829052825282518084018452818152602081810183905280840191909152835160c081810186528382528183018490528186018490526060808301859052608080840186905260a080850187905287890194909452818701869052958601859052865160e081018852808401868152818401879052815287518089018952868152808601879052818601528751928301885285835293820185905281870185905281810185905281860185905291810184905294820194909452928301819052908201525b90565b6136746011838363ffffffff613da216565b7f707e8cc63d34f6a1906248ce9fb061134c766bcf45438c21f6a88258f66739298260405180806020018281038252838181518152602001915080519060200190808383600083146136e1575b8051825260208311156136e157601f1990920191602091820191016136c1565b505050905090810190601f16801561370d5780820380516001836020036101000a031916815260200191505b509250505060405180910390a15b5050565b6000808080805b30600160a060020a03166311d9df496000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050506040518051905060ff168260ff16101561393b5730600160a060020a0316639052c845836000604051602001526040518263ffffffff1660e060020a028152600401808260ff1660ff168152602001915050602060405180830381600087803b156100005760325a03f1156100005750506040805180516000602092830181905283517faf5e84be000000000000000000000000000000000000000000000000000000008152600481018d905260ff8c1660248201529351919550600160a060020a038616945063af5e84be936044808201949392918390030190829087803b156100005760325a03f11561000057505050604051805190508501945080600160a060020a0316637c4d6771886000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f11561000057505050604051805190508401935080600160a060020a031663671b37936000604051602001526040518163ffffffff1660e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050604051519390930192505b600190910190613726565b5b50509250925092565b600030600160a060020a0316636b87cdc4336000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f115610000575050604051519150505b919050565b600060008260ff166001811161000057905060008160018111610000571415613a565730600160a060020a031663b89a73cb856000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151925061335a9050565b6001816001811161000057141561335a5730600160a060020a031663c5d40631856000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151925061335a9050565b5b5092915050565b600060006000600060006000600030600160a060020a031663aad0c3878a6000604051602001526040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a03168152602001915050602060405180830381600087803b156100005760325a03f11561000057505060405151965050851515613b735760009650613d2f565b600030600160a060020a031663d8b1fbff886000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f115610000575050506040518051905060ff161115613be65760009650613d2f565b613bf486896040015161371f565b94509450945087602001518860000151840281156100005704915081851015613d295787606001511515613c2b5760009650613d2f565b30600160a060020a0316639052c84560006000604051602001526040518263ffffffff1660e060020a028152600401808260ff168152602001915050602060405180830381600087803b156100005760325a03f1156100005750505060405180519050600160a060020a031663359f6b1a876000604051602001526040518263ffffffff1660e060020a02815260040180828152602001915050602060405180830381600087803b156100005760325a03f115610000575050604051516001604060020a03169150504281901015613d065760009650613d2f565b60208801518851850281156100005704915081851015613d295760009650613d2f565b5b600196505b50505050505092915050565b6000816040518082805190602001908083835b60208310613d6d5780518252601f199092019160209182019101613d4e565b6001836020036101000a038019825116818451168082178552505050505050905001915050604051809103902090505b919050565b6000613dad83613d3b565b600160e060020a031981166000908152602086815260409182902085518051825491840151151561010090810261ff001960ff93841660ff19958616178116919091178555858a015180516001870180549289015115158502918616928716929092178316179055868a015180516002870155958601516003860155958501516004850180546060808901516080808b015160a0909b01511515605060020a026aff00000000000000000000196001604060020a039c8d16620100000269ffffffffffffffff000019941515909902979099169490991693909317909a169390931798909816929092179290921692909217909155860151600590910180549387015133600160a060020a039081166801000000000000000090810242871692909316027fffffffff0000000000000000000000000000000000000000ffffffffffffffff9490951667ffffffffffffffff1996871617841694909417909416929092171691909117905590505b505050505600a165627a7a72305820515c2c05c04a38bc20dc7f2693351a3e3d5bb362a6ad7f812529df0e1100fd160029",
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
    "updated_at": 1486036778458,
    "links": {
      "AccountingLib": "0x36eed73ca021b17024b75c29e6d86f588c15ce53",
      "BylawsLib": "0xebdc3d309b45744f6a1b6793a4051537b65a1490"
    },
    "address": "0xa2306297d526c1ba36ca3d2c30bde0af9d0931e6"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Company";
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
    window.Company = Contract;
  }
})();
