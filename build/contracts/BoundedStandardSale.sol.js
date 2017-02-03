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
      throw new Error("BoundedStandardSale error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("BoundedStandardSale error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("BoundedStandardSale contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of BoundedStandardSale: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to BoundedStandardSale.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: BoundedStandardSale not deployed or address not set.");
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
        "name": "maxUnits",
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
        "name": "minUnits",
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
            "name": "_min",
            "type": "uint256"
          },
          {
            "name": "_max",
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
    "unlinked_binary": "0x60606040523461000057604051610f36380380610f3683398101604090815281516020830151918301516060840151608085015160a086015160c087015194969394929391929091015b60048054600160a060020a031916600160a060020a0389161760a060020a60ff0219167401000000000000000000000000000000000000000060ff891602179055600a859055600b849055600c839055600680546001604060020a0319166001604060020a038416179055805160058054600082905290917f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0602060026101006001861615026000190190941693909304601f90810184900482019386019083901061012057805160ff191683800117855561014d565b8280016001018555821561014d579182015b8281111561014d578251825591602001919060010190610132565b5b5061016e9291505b8082111561016a5760008155600101610156565b5090565b50505b505050505050505b610dae806101886000396000f3006060604052361561014e5763ffffffff60e060020a60003504166306517a29811461016057806324179b531461017f5780632f2daf79146101a3578063321b4749146101c45780633c68eb81146101e35780633feb5f2b146101f2578063457100741461021e578063473aa3881461022d57806348d79b6d1461028257806349a59f17146102ac57806353e1ead914610339578063569e35db1461036257806356c3b68d14610384578063582c6d70146103a35780635ed9ebfc146103c25780636904c94d146103e157806369bb4dc21461040a57806385131976146104295780638f7d7f181461044857806397a993aa1461046c578063a035b1fe14610497578063b38d55c3146104b6578063baac4009146104d7578063c502b13b146104fa578063c59ee1dc14610587578063e23e3229146105a6578063f088d547146105c5578063fd11cb0714610362575b61015e5b61015b336105fd565b5b565b005b346100005761016d610723565b60408051918252519081900360200190f35b346100005761018f600435610729565b604080519115158252519081900360200190f35b346100005761018f610755565b604080519115158252519081900360200190f35b346100005761016d610760565b60408051918252519081900360200190f35b346100005761015e61076b565b005b3461000057610202600435610899565b60408051600160a060020a039092168252519081900360200190f35b346100005761015e6108b4565b005b346100005761015e600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610a2995505050505050565b005b346100005761028f610aeb565b6040805167ffffffffffffffff9092168252519081900360200190f35b34610000576102b9610afb565b6040805160208082528351818301528351919283929083019185019080838382156102ff575b8051825260208311156102ff57601f1990920191602091820191016102df565b505050905090810190601f16801561032b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610202610b89565b60408051600160a060020a039092168252519081900360200190f35b346100005761016d600435610b98565b60408051918252519081900360200190f35b346100005761016d610ba1565b60408051918252519081900360200190f35b346100005761016d610ba7565b60408051918252519081900360200190f35b346100005761016d610bad565b60408051918252519081900360200190f35b3461000057610202610bb3565b60408051600160a060020a039092168252519081900360200190f35b346100005761016d610bc3565b60408051918252519081900360200190f35b346100005761016d610bce565b60408051918252519081900360200190f35b346100005761018f600435610bd9565b604080519115158252519081900360200190f35b346100005761016d600160a060020a0360043516610c02565b60408051918252519081900360200190f35b346100005761016d610c14565b60408051918252519081900360200190f35b346100005761015e600160a060020a0360043516602435604435610c1a565b005b34610000576104e4610cbe565b6040805160ff9092168252519081900360200190f35b34610000576102b9610cdf565b6040805160208082528351818301528351919283929083019185019080838382156102ff575b8051825260208311156102ff57601f1990920191602091820191016102df565b505050905090810190601f16801561032b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761016d610d6d565b60408051918252519081900360200190f35b346100005761016d610d73565b60408051918252519081900360200190f35b61015e600160a060020a03600435166105fd565b005b346100005761016d600435610b98565b60408051918252519081900360200190f35b6000600061060a34610b98565b3481156100005704915061061d34610b98565b820234039050600082111580610639575061063782610729565b155b1561064357610000565b61064b610bb3565b600160a060020a03166363677ff7600460149054906101000a900460ff1685856040518463ffffffff1660e060020a028152600401808460ff1660ff16815260200183600160a060020a0316600160a060020a031681526020018281526020019350505050600060405180830381600087803b156100005760325a03f115610000575050506106e383836106de34610b98565b610c1a565b600081111561071c57604051600160a060020a0384169082156108fc029083906000818181858888f19350505050151561071c57610000565b5b5b505050565b600b5481565b600081610734610bc3565b11801561074d575060065467ffffffffffffffff164211155b90505b919050565b600a54600154115b90565b600c54600b54025b90565b610773610755565b151561077e57610000565b60045433600160a060020a0390811691161461079957610000565b6004805460408051600060209182015290517fdf4ceef6000000000000000000000000000000000000000000000000000000008152928301908152600580546002600019600183161561010002019091160460248501819052600160a060020a039384169463df4ceef69430163193918291604401908490801561085e5780601f106108335761010080835404028352916020019161085e565b820191906000526020600020905b81548152906001019060200180831161084157829003601f168201915b5050925050506020604051808303818588803b156100005761235a5a03f115610000575050604051511515915061015b905057610000565b5b565b600860205260009081526040902054600160a060020a031681565b33600160a060020a038116600090815260076020526040812054906108d882610bd9565b15156108e357610000565b600082116108f057610000565b816108fa83610b98565b600160a060020a0385166000908152600760205260408120556003805492909102918290039055905061092b610bb3565b600160a060020a031663b2f48120600460149054906101000a900460ff1685856040518463ffffffff1660e060020a028152600401808460ff1660ff16815260200183600160a060020a0316600160a060020a031681526020018281526020019350505050600060405180830381600087803b156100005760325a03f115610000575050507f39993a02b44aa376d47d287d8dfdcc4e525161c7b829ed721092a2c6f8e8e9f6826109db84610b98565b6040805192835260208301919091528051918290030190a1604051600160a060020a0384169082156108fc029083906000818181858888f19350505050151561071c57610000565b5b505050565b60008054600260001961010060018416150201909116041115610a4b57610000565b8060009080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610a9757805160ff1916838001178555610ac4565b82800160010185558215610ac4579182015b82811115610ac4578251825591602001919060010190610aa9565b5b5061071c9291505b80821115610ae15760008155600101610acd565b5090565b50505b50565b60065467ffffffffffffffff1681565b6000805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610b815780601f10610b5657610100808354040283529160200191610b81565b820191906000526020600020905b815481529060010190602001808311610b6457829003601f168201915b505050505081565b600454600160a060020a031681565b600c545b919050565b600a5481565b60025481565b60015481565b600454600160a060020a03165b90565b600154600b54035b90565b600c54600a54025b90565b60065460009067ffffffffffffffff164211801561074d5750600a54600154105b90505b919050565b60076020526000908152604090205481565b600c5481565b600180548301815560038054838502019055600160a060020a03841660008181526007602090815260408083208054880190556009805484526008835292819020805473ffffffffffffffffffffffffffffffffffffffff191690941790935581549093019055805184815291820183905280517f4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e59281900390910190a15b505050565b60045474010000000000000000000000000000000000000000900460ff1681565b6005805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610b815780601f10610b5657610100808354040283529160200191610b81565b820191906000526020600020905b815481529060010190602001808311610b6457829003601f168201915b505050505081565b60035481565b60095481565b600c545b9190505600a165627a7a723058204f155cae99ad443ee2319d722180afd7e20eebe000093278bde1ad3541a6ea750029",
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
    "updated_at": 1486032053019,
    "links": {}
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "maxUnits",
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
        "name": "minUnits",
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
            "name": "_min",
            "type": "uint256"
          },
          {
            "name": "_max",
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
    "unlinked_binary": "0x60606040523461000057604051610f36380380610f3683398101604090815281516020830151918301516060840151608085015160a086015160c087015194969394929391929091015b60048054600160a060020a031916600160a060020a0389161760a060020a60ff0219167401000000000000000000000000000000000000000060ff891602179055600a859055600b849055600c839055600680546001604060020a0319166001604060020a038416179055805160058054600082905290917f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0602060026101006001861615026000190190941693909304601f90810184900482019386019083901061012057805160ff191683800117855561014d565b8280016001018555821561014d579182015b8281111561014d578251825591602001919060010190610132565b5b5061016e9291505b8082111561016a5760008155600101610156565b5090565b50505b505050505050505b610dae806101886000396000f3006060604052361561014e5763ffffffff60e060020a60003504166306517a29811461016057806324179b531461017f5780632f2daf79146101a3578063321b4749146101c45780633c68eb81146101e35780633feb5f2b146101f2578063457100741461021e578063473aa3881461022d57806348d79b6d1461028257806349a59f17146102ac57806353e1ead914610339578063569e35db1461036257806356c3b68d14610384578063582c6d70146103a35780635ed9ebfc146103c25780636904c94d146103e157806369bb4dc21461040a57806385131976146104295780638f7d7f181461044857806397a993aa1461046c578063a035b1fe14610497578063b38d55c3146104b6578063baac4009146104d7578063c502b13b146104fa578063c59ee1dc14610587578063e23e3229146105a6578063f088d547146105c5578063fd11cb0714610362575b61015e5b61015b336105fd565b5b565b005b346100005761016d610723565b60408051918252519081900360200190f35b346100005761018f600435610729565b604080519115158252519081900360200190f35b346100005761018f610755565b604080519115158252519081900360200190f35b346100005761016d610760565b60408051918252519081900360200190f35b346100005761015e61076b565b005b3461000057610202600435610899565b60408051600160a060020a039092168252519081900360200190f35b346100005761015e6108b4565b005b346100005761015e600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610a2995505050505050565b005b346100005761028f610aeb565b6040805167ffffffffffffffff9092168252519081900360200190f35b34610000576102b9610afb565b6040805160208082528351818301528351919283929083019185019080838382156102ff575b8051825260208311156102ff57601f1990920191602091820191016102df565b505050905090810190601f16801561032b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610202610b89565b60408051600160a060020a039092168252519081900360200190f35b346100005761016d600435610b98565b60408051918252519081900360200190f35b346100005761016d610ba1565b60408051918252519081900360200190f35b346100005761016d610ba7565b60408051918252519081900360200190f35b346100005761016d610bad565b60408051918252519081900360200190f35b3461000057610202610bb3565b60408051600160a060020a039092168252519081900360200190f35b346100005761016d610bc3565b60408051918252519081900360200190f35b346100005761016d610bce565b60408051918252519081900360200190f35b346100005761018f600435610bd9565b604080519115158252519081900360200190f35b346100005761016d600160a060020a0360043516610c02565b60408051918252519081900360200190f35b346100005761016d610c14565b60408051918252519081900360200190f35b346100005761015e600160a060020a0360043516602435604435610c1a565b005b34610000576104e4610cbe565b6040805160ff9092168252519081900360200190f35b34610000576102b9610cdf565b6040805160208082528351818301528351919283929083019185019080838382156102ff575b8051825260208311156102ff57601f1990920191602091820191016102df565b505050905090810190601f16801561032b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761016d610d6d565b60408051918252519081900360200190f35b346100005761016d610d73565b60408051918252519081900360200190f35b61015e600160a060020a03600435166105fd565b005b346100005761016d600435610b98565b60408051918252519081900360200190f35b6000600061060a34610b98565b3481156100005704915061061d34610b98565b820234039050600082111580610639575061063782610729565b155b1561064357610000565b61064b610bb3565b600160a060020a03166363677ff7600460149054906101000a900460ff1685856040518463ffffffff1660e060020a028152600401808460ff1660ff16815260200183600160a060020a0316600160a060020a031681526020018281526020019350505050600060405180830381600087803b156100005760325a03f115610000575050506106e383836106de34610b98565b610c1a565b600081111561071c57604051600160a060020a0384169082156108fc029083906000818181858888f19350505050151561071c57610000565b5b5b505050565b600b5481565b600081610734610bc3565b11801561074d575060065467ffffffffffffffff164211155b90505b919050565b600a54600154115b90565b600c54600b54025b90565b610773610755565b151561077e57610000565b60045433600160a060020a0390811691161461079957610000565b6004805460408051600060209182015290517fdf4ceef6000000000000000000000000000000000000000000000000000000008152928301908152600580546002600019600183161561010002019091160460248501819052600160a060020a039384169463df4ceef69430163193918291604401908490801561085e5780601f106108335761010080835404028352916020019161085e565b820191906000526020600020905b81548152906001019060200180831161084157829003601f168201915b5050925050506020604051808303818588803b156100005761235a5a03f115610000575050604051511515915061015b905057610000565b5b565b600860205260009081526040902054600160a060020a031681565b33600160a060020a038116600090815260076020526040812054906108d882610bd9565b15156108e357610000565b600082116108f057610000565b816108fa83610b98565b600160a060020a0385166000908152600760205260408120556003805492909102918290039055905061092b610bb3565b600160a060020a031663b2f48120600460149054906101000a900460ff1685856040518463ffffffff1660e060020a028152600401808460ff1660ff16815260200183600160a060020a0316600160a060020a031681526020018281526020019350505050600060405180830381600087803b156100005760325a03f115610000575050507f39993a02b44aa376d47d287d8dfdcc4e525161c7b829ed721092a2c6f8e8e9f6826109db84610b98565b6040805192835260208301919091528051918290030190a1604051600160a060020a0384169082156108fc029083906000818181858888f19350505050151561071c57610000565b5b505050565b60008054600260001961010060018416150201909116041115610a4b57610000565b8060009080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610a9757805160ff1916838001178555610ac4565b82800160010185558215610ac4579182015b82811115610ac4578251825591602001919060010190610aa9565b5b5061071c9291505b80821115610ae15760008155600101610acd565b5090565b50505b50565b60065467ffffffffffffffff1681565b6000805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610b815780601f10610b5657610100808354040283529160200191610b81565b820191906000526020600020905b815481529060010190602001808311610b6457829003601f168201915b505050505081565b600454600160a060020a031681565b600c545b919050565b600a5481565b60025481565b60015481565b600454600160a060020a03165b90565b600154600b54035b90565b600c54600a54025b90565b60065460009067ffffffffffffffff164211801561074d5750600a54600154105b90505b919050565b60076020526000908152604090205481565b600c5481565b600180548301815560038054838502019055600160a060020a03841660008181526007602090815260408083208054880190556009805484526008835292819020805473ffffffffffffffffffffffffffffffffffffffff191690941790935581549093019055805184815291820183905280517f4869f8a69900cd46da66cdd86111a5c46698b0db490bc721bc6155a22fc5e2e59281900390910190a15b505050565b60045474010000000000000000000000000000000000000000900460ff1681565b6005805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610b815780601f10610b5657610100808354040283529160200191610b81565b820191906000526020600020905b815481529060010190602001808311610b6457829003601f168201915b505050505081565b60035481565b60095481565b600c545b9190505600a165627a7a723058204f155cae99ad443ee2319d722180afd7e20eebe000093278bde1ad3541a6ea750029",
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
    "updated_at": 1486036778447,
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

  Contract.contract_name   = Contract.prototype.contract_name   = "BoundedStandardSale";
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
    window.BoundedStandardSale = Contract;
  }
})();
