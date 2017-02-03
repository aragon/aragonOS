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
      throw new Error("IssueableStock error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("IssueableStock error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("IssueableStock contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of IssueableStock: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to IssueableStock.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: IssueableStock not deployed or address not set.");
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
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "destroyStock",
        "outputs": [],
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
            "name": "lastEvent",
            "type": "uint64"
          }
        ],
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
            "name": "_value",
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
    "unlinked_binary": "0x606060405234610000575b611438806100196000396000f3006060604052361561017a5763ffffffff60e060020a60003504166306eb4e42811461017f57806306fdde031461019e57806318160ddd1461022b57806319eb8d481461024a578063359f6b1a1461027a578063380efed1146102a75780635610fe05146102d2578063567813881461030a5780635c134d66146103225780635eeb6e45146103505780636103d70b1461036e57806362c1e46a1461037d5780636457237b14610387578063671b3793146103eb5780636904c94d1461040a57806370a08231146104335780637c4d67711461045e5780639151c854146104805780639534e637146104ae57806395d89b41146104c0578063a9059cbb1461054d578063ab377daa1461056b578063af5e84be14610597578063b89a73cb146105bf578063bb8e10a7146105ec578063c6a8ad6814610626578063d8604e951461065c578063d96831e11461067f578063e1bf758614610691578063e2982c21146106b0578063e2d2e219146106db578063ef080611146106fe575b610000565b346100005761018c610722565b60408051918252519081900360200190f35b34610000576101ab610728565b6040805160208082528351818301528351919283929083019185019080838382156101f1575b8051825260208311156101f157601f1990920191602091820191016101d1565b505050905090810190601f16801561021d5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761018c6107b6565b60408051918252519081900360200190f35b3461000057610266600160a060020a03600435166024356107bc565b604080519115158252519081900360200190f35b346100005761028a6004356108da565b6040805167ffffffffffffffff9092168252519081900360200190f35b346100005761018c600160a060020a03600435166108f6565b60408051918252519081900360200190f35b346100005761018c600160a060020a036004351667ffffffffffffffff6024351661090a565b60408051918252519081900360200190f35b346100005761032060043560ff60243516610944565b005b346100005761018c600160a060020a0360043516602435610954565b60408051918252519081900360200190f35b3461000057610320600160a060020a0360043516602435610971565b005b34610000576103206109dc565b005b610320610a5c565b005b346100005761018c6004808035906020019082018035906020019080806020026020016040519081016040528093929190818152602001838360200280828437509496505093359350610ac592505050565b60408051918252519081900360200190f35b346100005761018c610b0c565b60408051918252519081900360200190f35b3461000057610417610b37565b60408051600160a060020a039092168252519081900360200190f35b346100005761018c600160a060020a0360043516610b46565b60408051918252519081900360200190f35b346100005761018c600435610b65565b60408051918252519081900360200190f35b346100005761018c600160a060020a0360043516602435610b77565b60408051918252519081900360200190f35b3461000057610320600435610bcc565b005b34610000576101ab610ced565b6040805160208082528351818301528351919283929083019185019080838382156101f1575b8051825260208311156101f157601f1990920191602091820191016101d1565b505050905090810190601f16801561021d5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610320600160a060020a0360043516602435610d7b565b005b3461000057610417600435610db6565b60408051600160a060020a039092168252519081900360200190f35b346100005761018c60043560ff60243516610dd1565b60408051918252519081900360200190f35b3461000057610266600160a060020a0360043516610dee565b604080519115158252519081900360200190f35b3461000057610266600160a060020a036004351667ffffffffffffffff60243516610e03565b604080519115158252519081900360200190f35b346100005761028a600160a060020a0360043516610ea4565b6040805167ffffffffffffffff9092168252519081900360200190f35b3461000057610669610f53565b6040805160ff9092168252519081900360200190f35b3461000057610320600435610f5c565b005b346100005761032060043567ffffffffffffffff60243516610fca565b005b346100005761018c600160a060020a03600435166110eb565b60408051918252519081900360200190f35b34610000576106696110fd565b6040805160ff9092168252519081900360200190f35b3461000057610320600160a060020a036004351660243560ff6044351661110b565b005b60035481565b6007805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156107ae5780601f10610783576101008083540402835291602001916107ae565b820191906000526020600020905b81548152906001019060200180831161079157829003601f168201915b505050505081565b60005481565b6000818152600a602052604081205467ffffffffffffffff164211156107e4575060006108d4565b6000610840600e80548060200260200160405190810160405280929190818152602001828054801561083557602002820191906000526020600020905b815481526020019060010190808311610821575b505050505084610ac5565b121561084e575060006108d4565b600160a060020a038316600090815260016020908152604080832054600d83528184208685529092529091205410610888575060006108d4565b600654600160a060020a03848116911614156108a6575060006108d4565b600160a060020a03831660009081526004602052604090205460ff1615156108d0575060006108d4565b5060015b92915050565b600a6020526000908152604090205467ffffffffffffffff1681565b6000610902824261090a565b90505b919050565b60006109168383610e03565b61093857600160a060020a03831660009081526001602052604090205461093b565b60005b90505b92915050565b61094f338383611138565b5b5050565b600d60209081526000928352604080842090915290825290205481565b60065433600160a060020a0390811691161461098c57610000565b61099860005482611239565b6000908155600160a060020a0383168152600160205260409020546109bd9082611239565b600160a060020a0383166000908152600160205260409020555b5b5050565b33600160a060020a038116600090815260056020526040902054801515610a0257610000565b8030600160a060020a0316311015610a1957610000565b600160a060020a0382166000818152600560205260408082208290555183156108fc0291849190818181858888f19350505050151561094f57610000565b5b5050565b60006000600060005434811561000057049250600091505b600354821015610abf5750600081815260026020908152604080832054600160a060020a0316808452600190925290912054610ab39082908502611252565b5b600190910190610a74565b5b505050565b6000805b8351811015610aff57828482815181101561000057906020019060200201511415610af657809150610b05565b5b600101610ac9565b60001991505b5092915050565b600954600654600160a060020a031660009081526001602052604081205490540360ff909116025b90565b600654600160a060020a031681565b600160a060020a0381166000908152600160205260409020545b919050565b600c6020526000908152604090205481565b600160a060020a038216600090815260016020908152604080832054600d83528184208585529092528220548291610bae91611239565b600954909150610bc290829060ff16611275565b91505b5092915050565b60065460009033600160a060020a03908116911614610bea57610000565b610c44600e805480602002602001604051908101604052809291908181526020018280548015610c3957602002820191906000526020600020905b815481526020019060010190808311610c25575b505050505083610ac5565b90506000811215610c5457610000565b600e546001901115610c9e57600e805460001981019081101561000057906000526020600020900160005b5054600e82815481101561000057906000526020600020900160005b50555b600e80546000198101808355919082908015829011610ce257600083815260209020610ce29181019083015b80821115610cde5760008155600101610cca565b5090565b5b505050505b5b5050565b6008805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156107ae5780601f10610783576101008083540402835291602001916107ae565b820191906000526020600020905b81548152906001019060200180831161079157829003601f168201915b505050505081565b610d8582826112a1565b600160a060020a03821660009081526004602052604090205460ff16151561094f5761094f82611376565b5b5b5050565b600260205260009081526040902054600160a060020a031681565b600b60209081526000928352604080842090915290825290205481565b60046020526000908152604090205460ff1681565b600080805b600e54821015610e9757600e82815481101561000057906000526020600020900160005b5054600160a060020a0386166000908152600d6020908152604080832084845290915281205491925090118015610e7d57506000818152600a602052604090205467ffffffffffffffff8086169116115b15610e8b5760019250610e9c565b5b600190910190610e08565b600092505b505092915050565b426000805b600e54821015610f4b57600e82815481101561000057906000526020600020900160005b5054600160a060020a0385166000908152600d6020908152604080832084845290915281205491925090118015610f1e57506000818152600a602052604090205467ffffffffffffffff8085169116115b15610f3f576000818152600a602052604090205467ffffffffffffffff1692505b5b600190910190610ea9565b5b5050919050565b60095460ff1681565b60065433600160a060020a03908116911614610f7757610000565b610f83600054826113d4565b6000908155600654600160a060020a0316815260016020526040902054610faa90826113d4565b600654600160a060020a03166000908152600160205260409020555b5b50565b60065433600160a060020a03908116911614610fe557610000565b6000828152600a602052604081205467ffffffffffffffff16111561100957610000565b4267ffffffffffffffff82161161101f57610000565b6000828152600a60205260409020805467ffffffffffffffff191667ffffffffffffffff8316179055600e805460018101808355828183801582901161108a5760008381526020902061108a9181019083015b80821115610cde5760008155600101610cca565b5090565b5b505050916000526020600020900160005b50839055506040805183815267ffffffffffffffff8316602082015281517f4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60929181900390910190a15b5b5050565b60056020526000908152604090205481565b600954610100900460ff1681565b60065433600160a060020a0390811691161461112657610000565b610abf838383611138565b5b5b505050565b600061114484846107bc565b151561114f57610000565b6111598484610b77565b6000848152600b6020908152604080832060ff8716845290915290205490915061118390826113d4565b6000848152600b6020908152604080832060ff87168452825280832093909355858252600c905220546111b690826113d4565b6000848152600c6020908152604080832093909355600160a060020a0387168083526001825283832054600d83528484208885528352928490209290925582518681529081019190915280820183905290517fe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e9181900360600190a15b50505050565b6000611247838311156113fc565b508082035b92915050565b600160a060020a03821660009081526005602052604090208054820190555b5050565b6000828202611296841580611291575083858381156100005704145b6113fc565b8091505b5092915050565b600160a060020a033316600090815260016020526040902054819010156112c757610000565b600160a060020a0333166000908152600160205260409020546112ea9082611239565b600160a060020a03338116600090815260016020526040808220939093559084168152205461131990826113d4565b600160a060020a038084166000818152600160209081526040918290209490945580518581529051919333909316927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a35b5050565b600160a060020a0381166000818152600460209081526040808320805460ff1916600190811790915560038054855260029093529220805473ffffffffffffffffffffffffffffffffffffffff191690931790925581540190555b50565b60008282016112968482108015906112915750838210155b6113fc565b8091505b5092915050565b801515610fc657610000565b5b505600a165627a7a723058201443fd23380091e1d7f956e2529e799b2265034810853a5c24beccd80252cbc20029",
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
    "updated_at": 1486123801975,
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
        "inputs": [
          {
            "name": "holder",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "destroyStock",
        "outputs": [],
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
            "name": "lastEvent",
            "type": "uint64"
          }
        ],
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
            "name": "_value",
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
    "unlinked_binary": "0x606060405234610000575b611438806100196000396000f3006060604052361561017a5763ffffffff60e060020a60003504166306eb4e42811461017f57806306fdde031461019e57806318160ddd1461022b57806319eb8d481461024a578063359f6b1a1461027a578063380efed1146102a75780635610fe05146102d2578063567813881461030a5780635c134d66146103225780635eeb6e45146103505780636103d70b1461036e57806362c1e46a1461037d5780636457237b14610387578063671b3793146103eb5780636904c94d1461040a57806370a08231146104335780637c4d67711461045e5780639151c854146104805780639534e637146104ae57806395d89b41146104c0578063a9059cbb1461054d578063ab377daa1461056b578063af5e84be14610597578063b89a73cb146105bf578063bb8e10a7146105ec578063c6a8ad6814610626578063d8604e951461065c578063d96831e11461067f578063e1bf758614610691578063e2982c21146106b0578063e2d2e219146106db578063ef080611146106fe575b610000565b346100005761018c610722565b60408051918252519081900360200190f35b34610000576101ab610728565b6040805160208082528351818301528351919283929083019185019080838382156101f1575b8051825260208311156101f157601f1990920191602091820191016101d1565b505050905090810190601f16801561021d5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761018c6107b6565b60408051918252519081900360200190f35b3461000057610266600160a060020a03600435166024356107bc565b604080519115158252519081900360200190f35b346100005761028a6004356108da565b6040805167ffffffffffffffff9092168252519081900360200190f35b346100005761018c600160a060020a03600435166108f6565b60408051918252519081900360200190f35b346100005761018c600160a060020a036004351667ffffffffffffffff6024351661090a565b60408051918252519081900360200190f35b346100005761032060043560ff60243516610944565b005b346100005761018c600160a060020a0360043516602435610954565b60408051918252519081900360200190f35b3461000057610320600160a060020a0360043516602435610971565b005b34610000576103206109dc565b005b610320610a5c565b005b346100005761018c6004808035906020019082018035906020019080806020026020016040519081016040528093929190818152602001838360200280828437509496505093359350610ac592505050565b60408051918252519081900360200190f35b346100005761018c610b0c565b60408051918252519081900360200190f35b3461000057610417610b37565b60408051600160a060020a039092168252519081900360200190f35b346100005761018c600160a060020a0360043516610b46565b60408051918252519081900360200190f35b346100005761018c600435610b65565b60408051918252519081900360200190f35b346100005761018c600160a060020a0360043516602435610b77565b60408051918252519081900360200190f35b3461000057610320600435610bcc565b005b34610000576101ab610ced565b6040805160208082528351818301528351919283929083019185019080838382156101f1575b8051825260208311156101f157601f1990920191602091820191016101d1565b505050905090810190601f16801561021d5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610320600160a060020a0360043516602435610d7b565b005b3461000057610417600435610db6565b60408051600160a060020a039092168252519081900360200190f35b346100005761018c60043560ff60243516610dd1565b60408051918252519081900360200190f35b3461000057610266600160a060020a0360043516610dee565b604080519115158252519081900360200190f35b3461000057610266600160a060020a036004351667ffffffffffffffff60243516610e03565b604080519115158252519081900360200190f35b346100005761028a600160a060020a0360043516610ea4565b6040805167ffffffffffffffff9092168252519081900360200190f35b3461000057610669610f53565b6040805160ff9092168252519081900360200190f35b3461000057610320600435610f5c565b005b346100005761032060043567ffffffffffffffff60243516610fca565b005b346100005761018c600160a060020a03600435166110eb565b60408051918252519081900360200190f35b34610000576106696110fd565b6040805160ff9092168252519081900360200190f35b3461000057610320600160a060020a036004351660243560ff6044351661110b565b005b60035481565b6007805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156107ae5780601f10610783576101008083540402835291602001916107ae565b820191906000526020600020905b81548152906001019060200180831161079157829003601f168201915b505050505081565b60005481565b6000818152600a602052604081205467ffffffffffffffff164211156107e4575060006108d4565b6000610840600e80548060200260200160405190810160405280929190818152602001828054801561083557602002820191906000526020600020905b815481526020019060010190808311610821575b505050505084610ac5565b121561084e575060006108d4565b600160a060020a038316600090815260016020908152604080832054600d83528184208685529092529091205410610888575060006108d4565b600654600160a060020a03848116911614156108a6575060006108d4565b600160a060020a03831660009081526004602052604090205460ff1615156108d0575060006108d4565b5060015b92915050565b600a6020526000908152604090205467ffffffffffffffff1681565b6000610902824261090a565b90505b919050565b60006109168383610e03565b61093857600160a060020a03831660009081526001602052604090205461093b565b60005b90505b92915050565b61094f338383611138565b5b5050565b600d60209081526000928352604080842090915290825290205481565b60065433600160a060020a0390811691161461098c57610000565b61099860005482611239565b6000908155600160a060020a0383168152600160205260409020546109bd9082611239565b600160a060020a0383166000908152600160205260409020555b5b5050565b33600160a060020a038116600090815260056020526040902054801515610a0257610000565b8030600160a060020a0316311015610a1957610000565b600160a060020a0382166000818152600560205260408082208290555183156108fc0291849190818181858888f19350505050151561094f57610000565b5b5050565b60006000600060005434811561000057049250600091505b600354821015610abf5750600081815260026020908152604080832054600160a060020a0316808452600190925290912054610ab39082908502611252565b5b600190910190610a74565b5b505050565b6000805b8351811015610aff57828482815181101561000057906020019060200201511415610af657809150610b05565b5b600101610ac9565b60001991505b5092915050565b600954600654600160a060020a031660009081526001602052604081205490540360ff909116025b90565b600654600160a060020a031681565b600160a060020a0381166000908152600160205260409020545b919050565b600c6020526000908152604090205481565b600160a060020a038216600090815260016020908152604080832054600d83528184208585529092528220548291610bae91611239565b600954909150610bc290829060ff16611275565b91505b5092915050565b60065460009033600160a060020a03908116911614610bea57610000565b610c44600e805480602002602001604051908101604052809291908181526020018280548015610c3957602002820191906000526020600020905b815481526020019060010190808311610c25575b505050505083610ac5565b90506000811215610c5457610000565b600e546001901115610c9e57600e805460001981019081101561000057906000526020600020900160005b5054600e82815481101561000057906000526020600020900160005b50555b600e80546000198101808355919082908015829011610ce257600083815260209020610ce29181019083015b80821115610cde5760008155600101610cca565b5090565b5b505050505b5b5050565b6008805460408051602060026001851615610100026000190190941693909304601f810184900484028201840190925281815292918301828280156107ae5780601f10610783576101008083540402835291602001916107ae565b820191906000526020600020905b81548152906001019060200180831161079157829003601f168201915b505050505081565b610d8582826112a1565b600160a060020a03821660009081526004602052604090205460ff16151561094f5761094f82611376565b5b5b5050565b600260205260009081526040902054600160a060020a031681565b600b60209081526000928352604080842090915290825290205481565b60046020526000908152604090205460ff1681565b600080805b600e54821015610e9757600e82815481101561000057906000526020600020900160005b5054600160a060020a0386166000908152600d6020908152604080832084845290915281205491925090118015610e7d57506000818152600a602052604090205467ffffffffffffffff8086169116115b15610e8b5760019250610e9c565b5b600190910190610e08565b600092505b505092915050565b426000805b600e54821015610f4b57600e82815481101561000057906000526020600020900160005b5054600160a060020a0385166000908152600d6020908152604080832084845290915281205491925090118015610f1e57506000818152600a602052604090205467ffffffffffffffff8085169116115b15610f3f576000818152600a602052604090205467ffffffffffffffff1692505b5b600190910190610ea9565b5b5050919050565b60095460ff1681565b60065433600160a060020a03908116911614610f7757610000565b610f83600054826113d4565b6000908155600654600160a060020a0316815260016020526040902054610faa90826113d4565b600654600160a060020a03166000908152600160205260409020555b5b50565b60065433600160a060020a03908116911614610fe557610000565b6000828152600a602052604081205467ffffffffffffffff16111561100957610000565b4267ffffffffffffffff82161161101f57610000565b6000828152600a60205260409020805467ffffffffffffffff191667ffffffffffffffff8316179055600e805460018101808355828183801582901161108a5760008381526020902061108a9181019083015b80821115610cde5760008155600101610cca565b5090565b5b505050916000526020600020900160005b50839055506040805183815267ffffffffffffffff8316602082015281517f4ce73f9ec6b37337fd908976b104b3ebb63f2f13ec695bf30d67e5f978392d60929181900390910190a15b5b5050565b60056020526000908152604090205481565b600954610100900460ff1681565b60065433600160a060020a0390811691161461112657610000565b610abf838383611138565b5b5b505050565b600061114484846107bc565b151561114f57610000565b6111598484610b77565b6000848152600b6020908152604080832060ff8716845290915290205490915061118390826113d4565b6000848152600b6020908152604080832060ff87168452825280832093909355858252600c905220546111b690826113d4565b6000848152600c6020908152604080832093909355600160a060020a0387168083526001825283832054600d83528484208885528352928490209290925582518681529081019190915280820183905290517fe7ee74ca1f4bb1b82b14f87794c45b3e59c39e372b862fb97a6316b43355b69e9181900360600190a15b50505050565b6000611247838311156113fc565b508082035b92915050565b600160a060020a03821660009081526005602052604090208054820190555b5050565b6000828202611296841580611291575083858381156100005704145b6113fc565b8091505b5092915050565b600160a060020a033316600090815260016020526040902054819010156112c757610000565b600160a060020a0333166000908152600160205260409020546112ea9082611239565b600160a060020a03338116600090815260016020526040808220939093559084168152205461131990826113d4565b600160a060020a038084166000818152600160209081526040918290209490945580518581529051919333909316927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a35b5050565b600160a060020a0381166000818152600460209081526040808320805460ff1916600190811790915560038054855260029093529220805473ffffffffffffffffffffffffffffffffffffffff191690931790925581540190555b50565b60008282016112968482108015906112915750838210155b6113fc565b8091505b5092915050565b801515610fc657610000565b5b505600a165627a7a723058201443fd23380091e1d7f956e2529e799b2265034810853a5c24beccd80252cbc20029",
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
    "updated_at": 1486036778475,
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

  Contract.contract_name   = Contract.prototype.contract_name   = "IssueableStock";
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
    window.IssueableStock = Contract;
  }
})();
