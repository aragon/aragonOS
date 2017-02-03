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
      throw new Error("IndividualInvestorSale error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("IndividualInvestorSale error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("IndividualInvestorSale contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of IndividualInvestorSale: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to IndividualInvestorSale.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: IndividualInvestorSale not deployed or address not set.");
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
        "name": "investor",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "isBuyingAllowed",
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
        "inputs": [],
        "name": "isFundsTransferAllowed",
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
        "inputs": [],
        "name": "raiseMaximum",
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
        "name": "transferFunds",
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
        "name": "investors",
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
        "inputs": [],
        "name": "sell",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_txid",
            "type": "string"
          }
        ],
        "name": "setTxid",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "closeDate",
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
        "inputs": [],
        "name": "txid",
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
        "name": "companyAddress",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellingPrice",
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
        "name": "boughtTokens",
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
        "name": "soldTokens",
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
        "inputs": [],
        "name": "availableTokens",
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
        "name": "raiseTarget",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "isSellingAllowed",
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
        "inputs": [],
        "name": "units",
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
        "name": "buyers",
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
        "name": "price",
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
            "name": "investor",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          },
          {
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "afterBuy",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "stockId",
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
        "name": "saleTitle",
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
        "name": "raisedAmount",
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
        "name": "investorIndex",
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
          }
        ],
        "name": "buy",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyingPrice",
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
        "inputs": [
          {
            "name": "_companyAddress",
            "type": "address"
          },
          {
            "name": "_stockId",
            "type": "uint8"
          },
          {
            "name": "_investor",
            "type": "address"
          },
          {
            "name": "_units",
            "type": "uint256"
          },
          {
            "name": "_price",
            "type": "uint256"
          },
          {
            "name": "_closeDate",
            "type": "uint64"
          },
          {
            "name": "_title",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "constructor"
      },
      {
        "payable": true,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockBought",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockSold",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040523461000057604051610e34380380610e3483398101604090815281516020830151918301516060840151608085015160a086015160c087015194969394929391929091015b60048054600160a060020a0319908116600160a060020a038a81169190911760a060020a60ff0219167401000000000000000000000000000000000000000060ff8b160217909255600b859055600a869055600680546001604060020a0319166001604060020a038616179055600c8054909116918716919091179055805160058054600082905290917f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0602060026101006001861615026000190190941693909304601f90810184900482019386019083901061013257805160ff191683800117855561015f565b8280016001018555821561015f579182015b8281111561015f578251825591602001919060010190610144565b5b506101809291505b8082111561017c5760008155600101610168565b5090565b50505b505050505050505b610c9a8061019a6000396000f3006060604052361561014e5763ffffffff60e060020a6000350416631e0018d6811461016057806324179b53146101895780632f2daf79146101ad578063321b4749146101ce5780633c68eb81146101ed5780633feb5f2b146101fc5780634571007414610228578063473aa3881461023757806348d79b6d1461028c57806349a59f17146102b657806353e1ead914610343578063569e35db1461036c578063582c6d701461038e5780635ed9ebfc146103ad5780636904c94d146103cc57806369bb4dc2146103f557806385131976146101ce5780638f7d7f1814610433578063976a84351461045757806397a993aa14610476578063a035b1fe146104a1578063b38d55c3146104c0578063baac4009146104e1578063c502b13b14610504578063c59ee1dc14610591578063e23e3229146105b0578063f088d547146105cf578063fd11cb07146105e5575b61015e5b61015b33610607565b5b565b005b346100005761016d610770565b60408051600160a060020a039092168252519081900360200190f35b346100005761019960043561077f565b604080519115158252519081900360200190f35b34610000576101996107c2565b604080519115158252519081900360200190f35b34610000576101db6107d3565b60408051918252519081900360200190f35b346100005761015e6107de565b005b346100005761016d60043561090c565b60408051600160a060020a039092168252519081900360200190f35b346100005761015e610927565b005b346100005761015e600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061092e95505050505050565b005b34610000576102996109f0565b6040805167ffffffffffffffff9092168252519081900360200190f35b34610000576102c3610a00565b604080516020808252835181830152835191928392908301918501908083838215610309575b80518252602083111561030957601f1990920191602091820191016102e9565b505050905090810190601f1680156103355780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761016d610a8e565b60408051600160a060020a039092168252519081900360200190f35b34610000576101db600435610a9d565b60408051918252519081900360200190f35b34610000576101db610aa5565b60408051918252519081900360200190f35b34610000576101db610aab565b60408051918252519081900360200190f35b346100005761016d610ab1565b60408051600160a060020a039092168252519081900360200190f35b34610000576101db610ac1565b60408051918252519081900360200190f35b34610000576101db6107d3565b60408051918252519081900360200190f35b3461000057610199600435610a9d565b604080519115158252519081900360200190f35b34610000576101db610af9565b60408051918252519081900360200190f35b34610000576101db600160a060020a0360043516610aff565b60408051918252519081900360200190f35b34610000576101db610b11565b60408051918252519081900360200190f35b346100005761015e600160a060020a0360043516602435604435610b17565b005b34610000576104ee610bbb565b6040805160ff9092168252519081900360200190f35b34610000576102c3610bcb565b604080516020808252835181830152835191928392908301918501908083838215610309575b80518252602083111561030957601f1990920191602091820191016102e9565b505050905090810190601f1680156103355780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101db610c59565b60408051918252519081900360200190f35b34610000576101db610c5f565b60408051918252519081900360200190f35b61015e600160a060020a0360043516610607565b005b34610000576101db600435610c65565b60408051918252519081900360200190f35b600c54600090600160a060020a0383811691161461062457610000565b61062d34610c65565b600a540234101561063d57610000565b610648600a5461077f565b151561065357610000565b61065c34610c65565b600a54600c805474ff0000000000000000000000000000000000000000191660a060020a1790550234039050610690610ab1565b60048054600c54600a54604080517f63677ff700000000000000000000000000000000000000000000000000000000815260a060020a90940460ff1694840194909452600160a060020a0391821660248401526044830152915192909116916363677ff79160648082019260009290919082900301818387803b156100005760325a03f1156100005750505061073182600a5461072c34610c65565b610b17565b600081111561076a57604051600160a060020a0383169082156108fc029083906000818181858888f19350505050151561076a57610000565b5b5b5050565b600c54600160a060020a031681565b600c5460009060a060020a900460ff161580156107a25750816107a0610ac1565b145b80156107ba575060065467ffffffffffffffff164211155b90505b919050565b600c5460a060020a900460ff165b90565b600b54600a54025b90565b6107e66107c2565b15156107f157610000565b60045433600160a060020a0390811691161461080c57610000565b6004805460408051600060209182015290517fdf4ceef6000000000000000000000000000000000000000000000000000000008152928301908152600580546002600019600183161561010002019091160460248501819052600160a060020a039384169463df4ceef6943016319391829160440190849080156108d15780601f106108a6576101008083540402835291602001916108d1565b820191906000526020600020905b8154815290600101906020018083116108b457829003601f168201915b5050925050506020604051808303818588803b156100005761235a5a03f115610000575050604051511515915061015b905057610000565b5b565b600860205260009081526040902054600160a060020a031681565b610000565b565b6000805460026000196101006001841615020190911604111561095057610000565b8060009080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061099c57805160ff19168380011785556109c9565b828001600101855582156109c9579182015b828111156109c95782518255916020019190600101906109ae565b5b506109ea9291505b808211156109e657600081556001016109d2565b5090565b50505b50565b60065467ffffffffffffffff1681565b6000805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610a865780601f10610a5b57610100808354040283529160200191610a86565b820191906000526020600020905b815481529060010190602001808311610a6957829003601f168201915b505050505081565b600454600160a060020a031681565b60005b919050565b60025481565b60015481565b600454600160a060020a03165b90565b600c5460009060a060020a900460ff16610add57600a54610ae0565b60005b90505b90565b600b54600a54025b90565b60005b919050565b600a5481565b60076020526000908152604090205481565b600b5481565b600180548301815560038054838502019055600160a060020a03841660008181526007602090815260408083208054880190556009805484526008835292819020805473ffffffffffffffffffffffffffffffffffffffff191690941790935581549093019055805184815291820183905280517f4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e59281900390910190a15b505050565b60045460a060020a900460ff1681565b6005805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610a865780601f10610a5b57610100808354040283529160200191610a86565b820191906000526020600020905b815481529060010190602001808311610a6957829003601f168201915b505050505081565b60035481565b60095481565b600b545b9190505600a165627a7a7230582020656b6f868dbdd8a4712bfdd08d68896bdaba7dcbcbc3bdf449f58b69c0d5570029",
    "events": {
      "0x4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e5": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockBought",
        "type": "event"
      },
      "0x39993a02b44aa376d47d287d8dfdcc4e525161c7b829ed721092a2c6f8e8e9f6": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockSold",
        "type": "event"
      }
    },
    "updated_at": 1486032053044,
    "links": {}
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "investor",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "isBuyingAllowed",
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
        "inputs": [],
        "name": "isFundsTransferAllowed",
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
        "inputs": [],
        "name": "raiseMaximum",
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
        "name": "transferFunds",
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
        "name": "investors",
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
        "inputs": [],
        "name": "sell",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_txid",
            "type": "string"
          }
        ],
        "name": "setTxid",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "closeDate",
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
        "inputs": [],
        "name": "txid",
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
        "name": "companyAddress",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellingPrice",
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
        "name": "boughtTokens",
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
        "name": "soldTokens",
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
        "inputs": [],
        "name": "availableTokens",
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
        "name": "raiseTarget",
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
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "isSellingAllowed",
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
        "inputs": [],
        "name": "units",
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
        "name": "buyers",
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
        "name": "price",
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
            "name": "investor",
            "type": "address"
          },
          {
            "name": "units",
            "type": "uint256"
          },
          {
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "afterBuy",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "stockId",
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
        "name": "saleTitle",
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
        "name": "raisedAmount",
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
        "name": "investorIndex",
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
          }
        ],
        "name": "buy",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyingPrice",
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
        "inputs": [
          {
            "name": "_companyAddress",
            "type": "address"
          },
          {
            "name": "_stockId",
            "type": "uint8"
          },
          {
            "name": "_investor",
            "type": "address"
          },
          {
            "name": "_units",
            "type": "uint256"
          },
          {
            "name": "_price",
            "type": "uint256"
          },
          {
            "name": "_closeDate",
            "type": "uint64"
          },
          {
            "name": "_title",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "constructor"
      },
      {
        "payable": true,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockBought",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockSold",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040523461000057604051610e34380380610e3483398101604090815281516020830151918301516060840151608085015160a086015160c087015194969394929391929091015b60048054600160a060020a0319908116600160a060020a038a81169190911760a060020a60ff0219167401000000000000000000000000000000000000000060ff8b160217909255600b859055600a869055600680546001604060020a0319166001604060020a038616179055600c8054909116918716919091179055805160058054600082905290917f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0602060026101006001861615026000190190941693909304601f90810184900482019386019083901061013257805160ff191683800117855561015f565b8280016001018555821561015f579182015b8281111561015f578251825591602001919060010190610144565b5b506101809291505b8082111561017c5760008155600101610168565b5090565b50505b505050505050505b610c9a8061019a6000396000f3006060604052361561014e5763ffffffff60e060020a6000350416631e0018d6811461016057806324179b53146101895780632f2daf79146101ad578063321b4749146101ce5780633c68eb81146101ed5780633feb5f2b146101fc5780634571007414610228578063473aa3881461023757806348d79b6d1461028c57806349a59f17146102b657806353e1ead914610343578063569e35db1461036c578063582c6d701461038e5780635ed9ebfc146103ad5780636904c94d146103cc57806369bb4dc2146103f557806385131976146101ce5780638f7d7f1814610433578063976a84351461045757806397a993aa14610476578063a035b1fe146104a1578063b38d55c3146104c0578063baac4009146104e1578063c502b13b14610504578063c59ee1dc14610591578063e23e3229146105b0578063f088d547146105cf578063fd11cb07146105e5575b61015e5b61015b33610607565b5b565b005b346100005761016d610770565b60408051600160a060020a039092168252519081900360200190f35b346100005761019960043561077f565b604080519115158252519081900360200190f35b34610000576101996107c2565b604080519115158252519081900360200190f35b34610000576101db6107d3565b60408051918252519081900360200190f35b346100005761015e6107de565b005b346100005761016d60043561090c565b60408051600160a060020a039092168252519081900360200190f35b346100005761015e610927565b005b346100005761015e600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061092e95505050505050565b005b34610000576102996109f0565b6040805167ffffffffffffffff9092168252519081900360200190f35b34610000576102c3610a00565b604080516020808252835181830152835191928392908301918501908083838215610309575b80518252602083111561030957601f1990920191602091820191016102e9565b505050905090810190601f1680156103355780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761016d610a8e565b60408051600160a060020a039092168252519081900360200190f35b34610000576101db600435610a9d565b60408051918252519081900360200190f35b34610000576101db610aa5565b60408051918252519081900360200190f35b34610000576101db610aab565b60408051918252519081900360200190f35b346100005761016d610ab1565b60408051600160a060020a039092168252519081900360200190f35b34610000576101db610ac1565b60408051918252519081900360200190f35b34610000576101db6107d3565b60408051918252519081900360200190f35b3461000057610199600435610a9d565b604080519115158252519081900360200190f35b34610000576101db610af9565b60408051918252519081900360200190f35b34610000576101db600160a060020a0360043516610aff565b60408051918252519081900360200190f35b34610000576101db610b11565b60408051918252519081900360200190f35b346100005761015e600160a060020a0360043516602435604435610b17565b005b34610000576104ee610bbb565b6040805160ff9092168252519081900360200190f35b34610000576102c3610bcb565b604080516020808252835181830152835191928392908301918501908083838215610309575b80518252602083111561030957601f1990920191602091820191016102e9565b505050905090810190601f1680156103355780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101db610c59565b60408051918252519081900360200190f35b34610000576101db610c5f565b60408051918252519081900360200190f35b61015e600160a060020a0360043516610607565b005b34610000576101db600435610c65565b60408051918252519081900360200190f35b600c54600090600160a060020a0383811691161461062457610000565b61062d34610c65565b600a540234101561063d57610000565b610648600a5461077f565b151561065357610000565b61065c34610c65565b600a54600c805474ff0000000000000000000000000000000000000000191660a060020a1790550234039050610690610ab1565b60048054600c54600a54604080517f63677ff700000000000000000000000000000000000000000000000000000000815260a060020a90940460ff1694840194909452600160a060020a0391821660248401526044830152915192909116916363677ff79160648082019260009290919082900301818387803b156100005760325a03f1156100005750505061073182600a5461072c34610c65565b610b17565b600081111561076a57604051600160a060020a0383169082156108fc029083906000818181858888f19350505050151561076a57610000565b5b5b5050565b600c54600160a060020a031681565b600c5460009060a060020a900460ff161580156107a25750816107a0610ac1565b145b80156107ba575060065467ffffffffffffffff164211155b90505b919050565b600c5460a060020a900460ff165b90565b600b54600a54025b90565b6107e66107c2565b15156107f157610000565b60045433600160a060020a0390811691161461080c57610000565b6004805460408051600060209182015290517fdf4ceef6000000000000000000000000000000000000000000000000000000008152928301908152600580546002600019600183161561010002019091160460248501819052600160a060020a039384169463df4ceef6943016319391829160440190849080156108d15780601f106108a6576101008083540402835291602001916108d1565b820191906000526020600020905b8154815290600101906020018083116108b457829003601f168201915b5050925050506020604051808303818588803b156100005761235a5a03f115610000575050604051511515915061015b905057610000565b5b565b600860205260009081526040902054600160a060020a031681565b610000565b565b6000805460026000196101006001841615020190911604111561095057610000565b8060009080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061099c57805160ff19168380011785556109c9565b828001600101855582156109c9579182015b828111156109c95782518255916020019190600101906109ae565b5b506109ea9291505b808211156109e657600081556001016109d2565b5090565b50505b50565b60065467ffffffffffffffff1681565b6000805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610a865780601f10610a5b57610100808354040283529160200191610a86565b820191906000526020600020905b815481529060010190602001808311610a6957829003601f168201915b505050505081565b600454600160a060020a031681565b60005b919050565b60025481565b60015481565b600454600160a060020a03165b90565b600c5460009060a060020a900460ff16610add57600a54610ae0565b60005b90505b90565b600b54600a54025b90565b60005b919050565b600a5481565b60076020526000908152604090205481565b600b5481565b600180548301815560038054838502019055600160a060020a03841660008181526007602090815260408083208054880190556009805484526008835292819020805473ffffffffffffffffffffffffffffffffffffffff191690941790935581549093019055805184815291820183905280517f4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e59281900390910190a15b505050565b60045460a060020a900460ff1681565b6005805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610a865780601f10610a5b57610100808354040283529160200191610a86565b820191906000526020600020905b815481529060010190602001808311610a6957829003601f168201915b505050505081565b60035481565b60095481565b600b545b9190505600a165627a7a7230582020656b6f868dbdd8a4712bfdd08d68896bdaba7dcbcbc3bdf449f58b69c0d5570029",
    "events": {
      "0x4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e5": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockBought",
        "type": "event"
      },
      "0x39993a02b44aa376d47d287d8dfdcc4e525161c7b829ed721092a2c6f8e8e9f6": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "units",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "price",
            "type": "uint256"
          }
        ],
        "name": "StockSold",
        "type": "event"
      }
    },
    "updated_at": 1486036778467,
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

  Contract.contract_name   = Contract.prototype.contract_name   = "IndividualInvestorSale";
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
    window.IndividualInvestorSale = Contract;
  }
})();
