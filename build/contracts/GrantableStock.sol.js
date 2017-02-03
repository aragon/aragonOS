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
      throw new Error("GrantableStock error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("GrantableStock error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("GrantableStock contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of GrantableStock: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to GrantableStock.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: GrantableStock not deployed or address not set.");
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
        "constant": true,
        "inputs": [],
        "name": "shareholderIndex",
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
        "name": "name",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "canVote",
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
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "grants",
        "outputs": [
          {
            "name": "value",
            "type": "uint256"
          },
          {
            "name": "cliff",
            "type": "uint64"
          },
          {
            "name": "vesting",
            "type": "uint64"
          },
          {
            "name": "date",
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
        "name": "pollingUntil",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "transferrable",
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
            "name": "holder",
            "type": "address"
          },
          {
            "name": "time",
            "type": "uint64"
          }
        ],
        "name": "transferrableShares",
        "outputs": [
          {
            "name": "nonVested",
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
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "vote",
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
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "voters",
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
        "inputs": [],
        "name": "withdrawPayments",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "splitDividends",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "array",
            "type": "uint256[]"
          },
          {
            "name": "element",
            "type": "uint256"
          }
        ],
        "name": "indexOf",
        "outputs": [
          {
            "name": "",
            "type": "int256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalVotingPower",
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
        "name": "company",
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
        "constant": true,
        "inputs": [
          {
            "name": "_owner",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "name": "balance",
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
            "type": "uint256"
          }
        ],
        "name": "totalCastedVotes",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "votingPowerForPoll",
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
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "closePoll",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "transfer",
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
        "name": "shareholders",
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
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "name": "votings",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "time",
            "type": "uint64"
          }
        ],
        "name": "hasShareholderVotedInOpenedPoll",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "lastStockIsTransferrableEvent",
        "outputs": [
          {
            "name": "date",
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
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "grantStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "votesPerShare",
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
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "pollingCloses",
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
            "name": "",
            "type": "address"
          }
        ],
        "name": "payments",
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
        "name": "dividendsPerShare",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "vote",
            "type": "uint8"
          }
        ],
        "name": "castVoteFromCompany",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
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
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "NewPoll",
        "type": "event"
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
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VoteCasted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b6119a5806100196000396000f300606060405236156101855763ffffffff60e060020a60003504166306eb4e42811461018a57806306fdde03146101a957806318160ddd1461023657806319eb8d48146102555780632c71e60a14610285578063359f6b1a146102d2578063380efed1146102fe5780635610fe051461032957806356781388146103605780635c134d66146103785780636103d70b146103a657806362c1e46a146103b55780636457237b146103bf578063671b3793146104235780636904c94d1461044257806370a082311461046b5780637c4d6771146104965780639151c854146104b85780639534e637146104e657806395d89b41146104f8578063a9059cbb14610585578063ab377daa146105a3578063af5e84be146105cf578063b89a73cb146105f7578063bb8e10a714610624578063c6a8ad681461065d578063c8342acb14610692578063d8604e95146106b0578063e1bf7586146106d3578063e2982c21146106f1578063e2d2e2191461071c578063ef0806111461073f578063fadbaa1b14610763575b610000565b3461000057610197610793565b60408051918252519081900360200190f35b34610000576101b6610799565b6040805160208082528351818301528351919283929083019185019080838382156101fc575b8051825260208311156101fc57601f1990920191602091820191016101dc565b505050905090810190601f1680156102285780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610197610827565b60408051918252519081900360200190f35b3461000057610271600160a060020a036004351660243561082d565b604080519115158252519081900360200190f35b34610000576102a1600160a060020a036004351660243561094a565b604080519485526001604060020a039384166020860152918316848301529091166060830152519081900360800190f35b34610000576102e26004356109a6565b604080516001604060020a039092168252519081900360200190f35b3461000057610197600160a060020a03600435166109c1565b60408051918252519081900360200190f35b3461000057610197600160a060020a03600435166001604060020a03602435166109d5565b60408051918252519081900360200190f35b346100005761037660043560ff60243516610ae4565b005b3461000057610197600160a060020a0360043516602435610af4565b60408051918252519081900360200190f35b3461000057610376610b11565b005b610376610b91565b005b34610000576101976004808035906020019082018035906020019080806020026020016040519081016040528093929190818152602001838360200280828437509496505093359350610bfa92505050565b60408051918252519081900360200190f35b3461000057610197610c41565b60408051918252519081900360200190f35b346100005761044f610c6c565b60408051600160a060020a039092168252519081900360200190f35b3461000057610197600160a060020a0360043516610c7b565b60408051918252519081900360200190f35b3461000057610197600435610c9a565b60408051918252519081900360200190f35b3461000057610197600160a060020a0360043516602435610cac565b60408051918252519081900360200190f35b3461000057610376600435610d01565b005b34610000576101b6610e22565b6040805160208082528351818301528351919283929083019185019080838382156101fc575b8051825260208311156101fc57601f1990920191602091820191016101dc565b505050905090810190601f1680156102285780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610376600160a060020a0360043516602435610eb0565b005b346100005761044f600435610ef0565b60408051600160a060020a039092168252519081900360200190f35b346100005761019760043560ff60243516610f0b565b60408051918252519081900360200190f35b3461000057610271600160a060020a0360043516610f28565b604080519115158252519081900360200190f35b3461000057610271600160a060020a03600435166001604060020a0360243516610f3d565b604080519115158252519081900360200190f35b34610000576102e2600160a060020a0360043516610fdd565b604080516001604060020a039092168252519081900360200190f35b3461000057610376600160a060020a036004351660243561108b565b005b34610000576106bd6110b6565b6040805160ff9092168252519081900360200190f35b34610000576103766004356001604060020a03602435166110bf565b005b3461000057610197600160a060020a03600435166111dc565b60408051918252519081900360200190f35b34610000576106bd6111ee565b6040805160ff9092168252519081900360200190f35b3461000057610376600160a060020a036004351660243560ff604435166111fc565b005b3461000057610376600160a060020a03600435166024356001604060020a0360443581169060643516611229565b005b60035481565b6007805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561081f5780601f106107f45761010080835404028352916020019161081f565b820191906000526020600020905b81548152906001019060200180831161080257829003601f168201915b505050505081565b60005481565b6000818152600a60205260408120546001604060020a031642111561085457506000610944565b60006108b0600e8054806020026020016040519081016040528092919081815260200182805480156108a557602002820191906000526020600020905b815481526020019060010190808311610891575b505050505084610bfa565b12156108be57506000610944565b600160a060020a038316600090815260016020908152604080832054600d835281842086855290925290912054106108f857506000610944565b600654600160a060020a038481169116141561091657506000610944565b600160a060020a03831660009081526004602052604090205460ff16151561094057506000610944565b5060015b92915050565b600f60205281600052604060002081815481101561000057906000526020600020906002020160005b5080546001909101549092506001604060020a038082169250680100000000000000008204811691608060020a90041684565b600a602052600090815260409020546001604060020a031681565b60006109cd82426109d5565b90505b919050565b600160a060020a0382166000908152600f602052604081205481805b82821015610aa057610a9284610a8d600f60008a600160a060020a0316600160a060020a0316815260200190815260200160002085815481101561000057906000526020600020906002020160005b5060408051608081018252825481526001909201546001604060020a038082166020850152680100000000000000008204811692840192909252608060020a900416606082015288611432565b611454565b93505b6001909101906109f1565b600160a060020a038616600090815260016020526040902054610ac3908561147c565b9050610ad881610ad38888611495565b6114cf565b93505b50505092915050565b610aef3383836114e9565b5b5050565b600d60209081526000928352604080842090915290825290205481565b33600160a060020a038116600090815260056020526040902054801515610b3757610000565b8030600160a060020a0316311015610b4e57610000565b600160a060020a0382166000818152600560205260408082208290555183156108fc0291849190818181858888f193505050501515610aef57610000565b5b5050565b60006000600060005434811561000057049250600091505b600354821015610bf45750600081815260026020908152604080832054600160a060020a0316808452600190925290912054610be890829085026115ea565b5b600190910190610ba9565b5b505050565b6000805b8351811015610c3457828482815181101561000057906020019060200201511415610c2b57809150610c3a565b5b600101610bfe565b60001991505b5092915050565b600954600654600160a060020a031660009081526001602052604081205490540360ff909116025b90565b600654600160a060020a031681565b600160a060020a0381166000908152600160205260409020545b919050565b600c6020526000908152604090205481565b600160a060020a038216600090815260016020908152604080832054600d83528184208585529092528220548291610ce39161147c565b600954909150610cf790829060ff1661160d565b91505b5092915050565b60065460009033600160a060020a03908116911614610d1f57610000565b610d79600e805480602002602001604051908101604052809291908181526020018280548015610d6e57602002820191906000526020600020905b815481526020019060010190808311610d5a575b505050505083610bfa565b90506000811215610d8957610000565b600e546001901115610dd357600e805460001981019081101561000057906000526020600020900160005b5054600e82815481101561000057906000526020600020900160005b50555b600e80546000198101808355919082908015829011610e1757600083815260209020610e179181019083015b80821115610e135760008155600101610dff565b5090565b5b505050505b5b5050565b6008805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561081f5780601f106107f45761010080835404028352916020019161081f565b820191906000526020600020905b81548152906001019060200180831161080257829003601f168201915b505050505081565b60065433600160a060020a03908116911614801590610ed75750610ed433426109d5565b81115b15610ee157610000565b610aef8282611639565b5b5050565b600260205260009081526040902054600160a060020a031681565b600b60209081526000928352604080842090915290825290205481565b60046020526000908152604090205460ff1681565b600080805b600e54821015610fd057600e82815481101561000057906000526020600020900160005b5054600160a060020a0386166000908152600d6020908152604080832084845290915281205491925090118015610fb657506000818152600a60205260409020546001604060020a038086169116115b15610fc45760019250610fd5565b5b600190910190610f42565b600092505b505092915050565b600060006000610ff5610fef85611674565b42611721565b600160a060020a0385166000908152600f602052604081205491945090925090505b8181101561108357600160a060020a0384166000908152600f6020526040902080546110789190839081101561000057906000526020600020906002020160005b50600101546801000000000000000090046001604060020a031684611721565b92505b600101611017565b5b5050919050565b60065433600160a060020a039081169116146110a657610000565b610aef8282610eb0565b5b5b5050565b60095460ff1681565b60065433600160a060020a039081169116146110da57610000565b6000828152600a60205260408120546001604060020a031611156110fd57610000565b426001604060020a0382161161111257610000565b6000828152600a60205260409020805467ffffffffffffffff19166001604060020a038316179055600e805460018101808355828183801582901161117c5760008381526020902061117c9181019083015b80821115610e135760008155600101610dff565b5090565b5b505050916000526020600020900160005b5083905550604080518381526001604060020a038316602082015281517f4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60929181900390910190a15b5b5050565b60056020526000908152604090205481565b600954610100900460ff1681565b60065433600160a060020a0390811691161461121757610000565b610bf48383836114e9565b5b5b505050565b60408051608081018252600080825260208201819052918101829052606081019190915260065433600160a060020a0390811691161461126857610000565b42836001604060020a0316101561127e57610000565b42826001604060020a0316101561129457610000565b816001604060020a0316836001604060020a031611156112b357610000565b608060405190810160405280858152602001846001604060020a03168152602001836001604060020a03168152602001426001604060020a03168152509050600f600086600160a060020a0316600160a060020a0316815260200190815260200160002080548060010182818154818355818115116113825760020281600202836000526020600020918201910161138291905b80821115610e13576000815560018101805477ffffffffffffffffffffffffffffffffffffffffffffffff19169055600201611347565b5090565b5b505050916000526020600020906002020160005b50825181556020830151600190910180546040850151606086015167ffffffffffffffff199092166001604060020a03948516176fffffffffffffffff0000000000000000191668010000000000000000918516919091021777ffffffffffffffff000000000000000000000000000000001916608060020a939091169290920291909117905550611429858561108b565b5b5b5050505050565b600061144b8360000151611446858561174e565b61147c565b90505b92915050565b600082820161147184821080159061146c5750838210155b611836565b8091505b5092915050565b600061148a83831115611836565b508082035b92915050565b60006114a18383610f3d565b6114c357600160a060020a03831660009081526001602052604090205461144b565b60005b90505b92915050565b60008183106114de578161144b565b825b90505b92915050565b60006114f5848461082d565b151561150057610000565b61150a8484610cac565b6000848152600b6020908152604080832060ff871684529091529020549091506115349082611454565b6000848152600b6020908152604080832060ff87168452825280832093909355858252600c905220546115679082611454565b6000848152600c6020908152604080832093909355600160a060020a0387168083526001825283832054600d83528484208885528352928490209290925582518681529081019190915280820183905290517fe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e9181900360600190a15b50505050565b600160a060020a03821660009081526005602052604090208054820190555b5050565b600082820261147184158061146c575083858381156100005704145b611836565b8091505b5092915050565b6116438282611846565b600160a060020a03821660009081526004602052604090205460ff161515610aef57610aef8261191b565b5b5b5050565b426000805b600e5482101561108357600e82815481101561000057906000526020600020900160005b5054600160a060020a0385166000908152600d60209081526040808320848452909152812054919250901180156116ed57506000818152600a60205260409020546001604060020a038085169116115b1561170d576000818152600a60205260409020546001604060020a031692505b5b600190910190611679565b5b5050919050565b6000816001604060020a0316836001604060020a031610156114de578161144b565b825b90505b92915050565b60006000600084602001516001604060020a0316846001604060020a0316101561177b5760009250610fd5565b84604001516001604060020a0316846001604060020a031611156117a25784519250610fd5565b84606001518560400151036001604060020a031685606001518660200151036001604060020a03168660000151028115610000570491508192506117ea85600001518361147c565b905061182b8386606001518760400151036001604060020a031687602001516001604060020a0316876001604060020a031603840281156100005704611454565b92505b505092915050565b80151561184257610000565b5b50565b600160a060020a0333166000908152600160205260409020548190101561186c57610000565b600160a060020a03331660009081526001602052604090205461188f908261147c565b600160a060020a0333811660009081526001602052604080822093909355908416815220546118be9082611454565b600160a060020a038084166000818152600160209081526040918290209490945580518581529051919333909316927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a35b5050565b600160a060020a0381166000818152600460209081526040808320805460ff1916600190811790915560038054855260029093529220805473ffffffffffffffffffffffffffffffffffffffff191690931790925581540190555b505600a165627a7a72305820ed81fe4e534d6f308049b1dd3efbec44ffcb396162e2f284e005df55db4ec05b0029",
    "events": {
      "0x4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "NewPoll",
        "type": "event"
      },
      "0xe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VoteCasted",
        "type": "event"
      },
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      }
    },
    "updated_at": 1486032053035,
    "links": {}
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "shareholderIndex",
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
        "name": "name",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "canVote",
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
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "grants",
        "outputs": [
          {
            "name": "value",
            "type": "uint256"
          },
          {
            "name": "cliff",
            "type": "uint64"
          },
          {
            "name": "vesting",
            "type": "uint64"
          },
          {
            "name": "date",
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
        "name": "pollingUntil",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "transferrable",
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
            "name": "holder",
            "type": "address"
          },
          {
            "name": "time",
            "type": "uint64"
          }
        ],
        "name": "transferrableShares",
        "outputs": [
          {
            "name": "nonVested",
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
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "vote",
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
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "voters",
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
        "inputs": [],
        "name": "withdrawPayments",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "splitDividends",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "array",
            "type": "uint256[]"
          },
          {
            "name": "element",
            "type": "uint256"
          }
        ],
        "name": "indexOf",
        "outputs": [
          {
            "name": "",
            "type": "int256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalVotingPower",
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
        "name": "company",
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
        "constant": true,
        "inputs": [
          {
            "name": "_owner",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "name": "balance",
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
            "type": "uint256"
          }
        ],
        "name": "totalCastedVotes",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "votingPowerForPoll",
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
            "name": "pollId",
            "type": "uint256"
          }
        ],
        "name": "closePoll",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "transfer",
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
        "name": "shareholders",
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
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "name": "votings",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "time",
            "type": "uint64"
          }
        ],
        "name": "hasShareholderVotedInOpenedPoll",
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
        "constant": true,
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "lastStockIsTransferrableEvent",
        "outputs": [
          {
            "name": "date",
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
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "grantStock",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "votesPerShare",
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
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "pollingCloses",
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
            "name": "",
            "type": "address"
          }
        ],
        "name": "payments",
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
        "name": "dividendsPerShare",
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
            "name": "voter",
            "type": "address"
          },
          {
            "name": "pollId",
            "type": "uint256"
          },
          {
            "name": "vote",
            "type": "uint8"
          }
        ],
        "name": "castVoteFromCompany",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
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
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "NewPoll",
        "type": "event"
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
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VoteCasted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b6119a5806100196000396000f300606060405236156101855763ffffffff60e060020a60003504166306eb4e42811461018a57806306fdde03146101a957806318160ddd1461023657806319eb8d48146102555780632c71e60a14610285578063359f6b1a146102d2578063380efed1146102fe5780635610fe051461032957806356781388146103605780635c134d66146103785780636103d70b146103a657806362c1e46a146103b55780636457237b146103bf578063671b3793146104235780636904c94d1461044257806370a082311461046b5780637c4d6771146104965780639151c854146104b85780639534e637146104e657806395d89b41146104f8578063a9059cbb14610585578063ab377daa146105a3578063af5e84be146105cf578063b89a73cb146105f7578063bb8e10a714610624578063c6a8ad681461065d578063c8342acb14610692578063d8604e95146106b0578063e1bf7586146106d3578063e2982c21146106f1578063e2d2e2191461071c578063ef0806111461073f578063fadbaa1b14610763575b610000565b3461000057610197610793565b60408051918252519081900360200190f35b34610000576101b6610799565b6040805160208082528351818301528351919283929083019185019080838382156101fc575b8051825260208311156101fc57601f1990920191602091820191016101dc565b505050905090810190601f1680156102285780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610197610827565b60408051918252519081900360200190f35b3461000057610271600160a060020a036004351660243561082d565b604080519115158252519081900360200190f35b34610000576102a1600160a060020a036004351660243561094a565b604080519485526001604060020a039384166020860152918316848301529091166060830152519081900360800190f35b34610000576102e26004356109a6565b604080516001604060020a039092168252519081900360200190f35b3461000057610197600160a060020a03600435166109c1565b60408051918252519081900360200190f35b3461000057610197600160a060020a03600435166001604060020a03602435166109d5565b60408051918252519081900360200190f35b346100005761037660043560ff60243516610ae4565b005b3461000057610197600160a060020a0360043516602435610af4565b60408051918252519081900360200190f35b3461000057610376610b11565b005b610376610b91565b005b34610000576101976004808035906020019082018035906020019080806020026020016040519081016040528093929190818152602001838360200280828437509496505093359350610bfa92505050565b60408051918252519081900360200190f35b3461000057610197610c41565b60408051918252519081900360200190f35b346100005761044f610c6c565b60408051600160a060020a039092168252519081900360200190f35b3461000057610197600160a060020a0360043516610c7b565b60408051918252519081900360200190f35b3461000057610197600435610c9a565b60408051918252519081900360200190f35b3461000057610197600160a060020a0360043516602435610cac565b60408051918252519081900360200190f35b3461000057610376600435610d01565b005b34610000576101b6610e22565b6040805160208082528351818301528351919283929083019185019080838382156101fc575b8051825260208311156101fc57601f1990920191602091820191016101dc565b505050905090810190601f1680156102285780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610376600160a060020a0360043516602435610eb0565b005b346100005761044f600435610ef0565b60408051600160a060020a039092168252519081900360200190f35b346100005761019760043560ff60243516610f0b565b60408051918252519081900360200190f35b3461000057610271600160a060020a0360043516610f28565b604080519115158252519081900360200190f35b3461000057610271600160a060020a03600435166001604060020a0360243516610f3d565b604080519115158252519081900360200190f35b34610000576102e2600160a060020a0360043516610fdd565b604080516001604060020a039092168252519081900360200190f35b3461000057610376600160a060020a036004351660243561108b565b005b34610000576106bd6110b6565b6040805160ff9092168252519081900360200190f35b34610000576103766004356001604060020a03602435166110bf565b005b3461000057610197600160a060020a03600435166111dc565b60408051918252519081900360200190f35b34610000576106bd6111ee565b6040805160ff9092168252519081900360200190f35b3461000057610376600160a060020a036004351660243560ff604435166111fc565b005b3461000057610376600160a060020a03600435166024356001604060020a0360443581169060643516611229565b005b60035481565b6007805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561081f5780601f106107f45761010080835404028352916020019161081f565b820191906000526020600020905b81548152906001019060200180831161080257829003601f168201915b505050505081565b60005481565b6000818152600a60205260408120546001604060020a031642111561085457506000610944565b60006108b0600e8054806020026020016040519081016040528092919081815260200182805480156108a557602002820191906000526020600020905b815481526020019060010190808311610891575b505050505084610bfa565b12156108be57506000610944565b600160a060020a038316600090815260016020908152604080832054600d835281842086855290925290912054106108f857506000610944565b600654600160a060020a038481169116141561091657506000610944565b600160a060020a03831660009081526004602052604090205460ff16151561094057506000610944565b5060015b92915050565b600f60205281600052604060002081815481101561000057906000526020600020906002020160005b5080546001909101549092506001604060020a038082169250680100000000000000008204811691608060020a90041684565b600a602052600090815260409020546001604060020a031681565b60006109cd82426109d5565b90505b919050565b600160a060020a0382166000908152600f602052604081205481805b82821015610aa057610a9284610a8d600f60008a600160a060020a0316600160a060020a0316815260200190815260200160002085815481101561000057906000526020600020906002020160005b5060408051608081018252825481526001909201546001604060020a038082166020850152680100000000000000008204811692840192909252608060020a900416606082015288611432565b611454565b93505b6001909101906109f1565b600160a060020a038616600090815260016020526040902054610ac3908561147c565b9050610ad881610ad38888611495565b6114cf565b93505b50505092915050565b610aef3383836114e9565b5b5050565b600d60209081526000928352604080842090915290825290205481565b33600160a060020a038116600090815260056020526040902054801515610b3757610000565b8030600160a060020a0316311015610b4e57610000565b600160a060020a0382166000818152600560205260408082208290555183156108fc0291849190818181858888f193505050501515610aef57610000565b5b5050565b60006000600060005434811561000057049250600091505b600354821015610bf45750600081815260026020908152604080832054600160a060020a0316808452600190925290912054610be890829085026115ea565b5b600190910190610ba9565b5b505050565b6000805b8351811015610c3457828482815181101561000057906020019060200201511415610c2b57809150610c3a565b5b600101610bfe565b60001991505b5092915050565b600954600654600160a060020a031660009081526001602052604081205490540360ff909116025b90565b600654600160a060020a031681565b600160a060020a0381166000908152600160205260409020545b919050565b600c6020526000908152604090205481565b600160a060020a038216600090815260016020908152604080832054600d83528184208585529092528220548291610ce39161147c565b600954909150610cf790829060ff1661160d565b91505b5092915050565b60065460009033600160a060020a03908116911614610d1f57610000565b610d79600e805480602002602001604051908101604052809291908181526020018280548015610d6e57602002820191906000526020600020905b815481526020019060010190808311610d5a575b505050505083610bfa565b90506000811215610d8957610000565b600e546001901115610dd357600e805460001981019081101561000057906000526020600020900160005b5054600e82815481101561000057906000526020600020900160005b50555b600e80546000198101808355919082908015829011610e1757600083815260209020610e179181019083015b80821115610e135760008155600101610dff565b5090565b5b505050505b5b5050565b6008805460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152929183018282801561081f5780601f106107f45761010080835404028352916020019161081f565b820191906000526020600020905b81548152906001019060200180831161080257829003601f168201915b505050505081565b60065433600160a060020a03908116911614801590610ed75750610ed433426109d5565b81115b15610ee157610000565b610aef8282611639565b5b5050565b600260205260009081526040902054600160a060020a031681565b600b60209081526000928352604080842090915290825290205481565b60046020526000908152604090205460ff1681565b600080805b600e54821015610fd057600e82815481101561000057906000526020600020900160005b5054600160a060020a0386166000908152600d6020908152604080832084845290915281205491925090118015610fb657506000818152600a60205260409020546001604060020a038086169116115b15610fc45760019250610fd5565b5b600190910190610f42565b600092505b505092915050565b600060006000610ff5610fef85611674565b42611721565b600160a060020a0385166000908152600f602052604081205491945090925090505b8181101561108357600160a060020a0384166000908152600f6020526040902080546110789190839081101561000057906000526020600020906002020160005b50600101546801000000000000000090046001604060020a031684611721565b92505b600101611017565b5b5050919050565b60065433600160a060020a039081169116146110a657610000565b610aef8282610eb0565b5b5b5050565b60095460ff1681565b60065433600160a060020a039081169116146110da57610000565b6000828152600a60205260408120546001604060020a031611156110fd57610000565b426001604060020a0382161161111257610000565b6000828152600a60205260409020805467ffffffffffffffff19166001604060020a038316179055600e805460018101808355828183801582901161117c5760008381526020902061117c9181019083015b80821115610e135760008155600101610dff565b5090565b5b505050916000526020600020900160005b5083905550604080518381526001604060020a038316602082015281517f4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60929181900390910190a15b5b5050565b60056020526000908152604090205481565b600954610100900460ff1681565b60065433600160a060020a0390811691161461121757610000565b610bf48383836114e9565b5b5b505050565b60408051608081018252600080825260208201819052918101829052606081019190915260065433600160a060020a0390811691161461126857610000565b42836001604060020a0316101561127e57610000565b42826001604060020a0316101561129457610000565b816001604060020a0316836001604060020a031611156112b357610000565b608060405190810160405280858152602001846001604060020a03168152602001836001604060020a03168152602001426001604060020a03168152509050600f600086600160a060020a0316600160a060020a0316815260200190815260200160002080548060010182818154818355818115116113825760020281600202836000526020600020918201910161138291905b80821115610e13576000815560018101805477ffffffffffffffffffffffffffffffffffffffffffffffff19169055600201611347565b5090565b5b505050916000526020600020906002020160005b50825181556020830151600190910180546040850151606086015167ffffffffffffffff199092166001604060020a03948516176fffffffffffffffff0000000000000000191668010000000000000000918516919091021777ffffffffffffffff000000000000000000000000000000001916608060020a939091169290920291909117905550611429858561108b565b5b5b5050505050565b600061144b8360000151611446858561174e565b61147c565b90505b92915050565b600082820161147184821080159061146c5750838210155b611836565b8091505b5092915050565b600061148a83831115611836565b508082035b92915050565b60006114a18383610f3d565b6114c357600160a060020a03831660009081526001602052604090205461144b565b60005b90505b92915050565b60008183106114de578161144b565b825b90505b92915050565b60006114f5848461082d565b151561150057610000565b61150a8484610cac565b6000848152600b6020908152604080832060ff871684529091529020549091506115349082611454565b6000848152600b6020908152604080832060ff87168452825280832093909355858252600c905220546115679082611454565b6000848152600c6020908152604080832093909355600160a060020a0387168083526001825283832054600d83528484208885528352928490209290925582518681529081019190915280820183905290517fe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e9181900360600190a15b50505050565b600160a060020a03821660009081526005602052604090208054820190555b5050565b600082820261147184158061146c575083858381156100005704145b611836565b8091505b5092915050565b6116438282611846565b600160a060020a03821660009081526004602052604090205460ff161515610aef57610aef8261191b565b5b5b5050565b426000805b600e5482101561108357600e82815481101561000057906000526020600020900160005b5054600160a060020a0385166000908152600d60209081526040808320848452909152812054919250901180156116ed57506000818152600a60205260409020546001604060020a038085169116115b1561170d576000818152600a60205260409020546001604060020a031692505b5b600190910190611679565b5b5050919050565b6000816001604060020a0316836001604060020a031610156114de578161144b565b825b90505b92915050565b60006000600084602001516001604060020a0316846001604060020a0316101561177b5760009250610fd5565b84604001516001604060020a0316846001604060020a031611156117a25784519250610fd5565b84606001518560400151036001604060020a031685606001518660200151036001604060020a03168660000151028115610000570491508192506117ea85600001518361147c565b905061182b8386606001518760400151036001604060020a031687602001516001604060020a0316876001604060020a031603840281156100005704611454565b92505b505092915050565b80151561184257610000565b5b50565b600160a060020a0333166000908152600160205260409020548190101561186c57610000565b600160a060020a03331660009081526001602052604090205461188f908261147c565b600160a060020a0333811660009081526001602052604080822093909355908416815220546118be9082611454565b600160a060020a038084166000818152600160209081526040918290209490945580518581529051919333909316927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a35b5050565b600160a060020a0381166000818152600460209081526040808320805460ff1916600190811790915560038054855260029093529220805473ffffffffffffffffffffffffffffffffffffffff191690931790925581540190555b505600a165627a7a72305820ed81fe4e534d6f308049b1dd3efbec44ffcb396162e2f284e005df55db4ec05b0029",
    "events": {
      "0x4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "closes",
            "type": "uint64"
          }
        ],
        "name": "NewPoll",
        "type": "event"
      },
      "0xe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "id",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "voter",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VoteCasted",
        "type": "event"
      },
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      }
    },
    "updated_at": 1486036778463,
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

  Contract.contract_name   = Contract.prototype.contract_name   = "GrantableStock";
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
    window.GrantableStock = Contract;
  }
})();
