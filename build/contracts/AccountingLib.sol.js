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
      throw new Error("AccountingLib error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("AccountingLib error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("AccountingLib contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of AccountingLib: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to AccountingLib.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: AccountingLib not deployed or address not set.");
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
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "period",
            "type": "AccountingLib.AccountingPeriod storage"
          }
        ],
        "name": "getAccountingPeriodState",
        "outputs": [
          {
            "name": "remainingBudget",
            "type": "uint256"
          },
          {
            "name": "periodCloses",
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
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "period",
            "type": "AccountingLib.AccountingPeriod storage"
          }
        ],
        "name": "projectPeriodExpenses",
        "outputs": [
          {
            "name": "expenses",
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
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "addTreasure",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
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
            "name": "to",
            "type": "address"
          },
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "startNow",
            "type": "bool"
          }
        ],
        "name": "sendRecurringFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "removeRecurringTransaction",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "registerIncome",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          }
        ],
        "name": "closeCurrentPeriod",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "initialBudget",
            "type": "uint256"
          },
          {
            "name": "initialPeriodDuration",
            "type": "uint64"
          },
          {
            "name": "initialDividendThreshold",
            "type": "uint256"
          }
        ],
        "name": "init",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          }
        ],
        "name": "performDueTransactions",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
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
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
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
            "name": "to",
            "type": "address"
          }
        ],
        "name": "sendFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
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
    "unlinked_binary": "0x606060405234610000575b611ec7806100196000396000f300606060405236156100935763ffffffff60e060020a60003504166306285e56811461009857806309904546146100c85780633405829e146100e85780636186d6641461013957806369efe0f1146101af5780638135e059146101bf578063af0d20a514610210578063c1145d0d1461021d578063c3f0da0b1461023d578063c608c59d1461024a578063d5da0e711461026a575b610000565b6100a66004356024356102c9565b6040805192835267ffffffffffffffff90911660208301528051918290030190f35b6100d660043560243561030e565b60408051918252519081900360200190f35b60408051602060046024803582810135601f810185900485028601850190965285855261013795833595939460449493929092019181908401838280828437509496506106ce95505050505050565b005b604080516020600460443581810135601f810184900484028501840190955284845261013794823594602480359560649492939190920191819084018382808284375094965050600160a060020a038535169467ffffffffffffffff602082013516945060400135151592506106e4915050565b005b610137600435602435610dfd565b005b60408051602060046024803582810135601f810185900485028601850190965285855261013795833595939460449493929092019181908401838280828437509496506112e395505050505050565b005b6101376004356112f9565b005b61013760043560243567ffffffffffffffff60443516606435611434565b005b61013760043561146b565b005b61013760043560243567ffffffffffffffff60443516606435611498565b005b604080516020600460443581810135601f810184900484028501840190955284845261013794823594602480359560649492939190920191819084018382808284375094965050509235600160a060020a031692506114ee915050565b005b600060006102d68461146b565b6102e0848461030e565b60078401546006850154600486015492909103935067ffffffffffffffff91821691160190505b9250929050565b600181015460005b60028401548110156106c6576106b983610140604051908101604052908160008201548152602001600182015481526020016002820154815260200160038201805480602002602001604051908101604052809291908181526020016000905b828210156104d1576000848152602081206006840201905b506040805161010081019091528154909190829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156104755780601f1061044a57610100808354040283529160200191610475565b820191906000526020600020905b81548152906001019060200180831161045857829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a0316604084015260a860020a90910467ffffffffffffffff166060909201919091529082526001929092019101610376565b50505090825250600482015467ffffffffffffffff808216602084015268010000000000000000820481166040840152608060020a90910460ff16151560608301526005830154608083015260068301541660a082015260079091015460c090910152600286018054849081101561000057906000526020600020906009020160005b506040805161018081019091528154909190829060808201908390829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156106445780601f1061061957610100808354040283529160200191610644565b820191906000526020600020905b81548152906001019060200180831161062757829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a031660408085019190915260a860020a90920467ffffffffffffffff908116606094850152938552600686015484169085015260078501549084015260089093015416910152611536565b820191505b600101610316565b5b5092915050565b6106df826000343330866000611589565b5b5050565b6040805161010080820183526000808352602080840182905283850182905260608085018390528551808301875283815260808087019190915260a080870185905260c080880186905260e0978801869052885161026081018a52610160810187815261018082018890526101a082018890526101c082018890528a518088018c528881526101e08301526102008201889052610220820188905261024082018890528152808601879052808a0187905284018690528851968701895260018088528786018f9052600160a060020a03308116898c01528d8116898701528885018f90529288015233909116908601529484018390528551948501865283855267ffffffffffffffff8881169286019290925294840182905242169383019390935291808085156108255760608401805188900367ffffffffffffffff1690525b6108688b6001604060405190810160405280601c81526020017f74657374696e672069742063616e2072656365697665206d6f6e6579000000008152508b6114ee565b6108718b611652565b925061087d8b8461030e565b9150610a9783610140604051908101604052908160008201548152602001600182015481526020016002820154815260200160038201805480602002602001604051908101604052809291908181526020016000905b82821015610a2e576000848152602081206006840201905b506040805161010081019091528154909190829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156109d25780601f106109a7576101008083540402835291602001916109d2565b820191906000526020600020905b8154815290600101906020018083116109b557829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a0316604084015260a860020a90910467ffffffffffffffff1660609092019190915290825260019290920191016108d3565b50505090825250600482015467ffffffffffffffff808216602084015268010000000000000000820481166040840152608060020a90910460ff16151560608301526005830154608083015260068301541660a082015260079091015460c09091015285611536565b905082600701548183011115610aac57610000565b8a6002018054806001018281815481835581811511610bc257600902816009028360005260206000209182019101610bc291905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a031990811690915560038501805490911690556004840180548482558593859390821615610100026000190190911604601f819010610b475750610b79565b601f016020900490600052602060002090810190610b7991905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff19908116909155600060078301556008820180549091169055600901610ae0565b5090565b5b505050916000526020600020906009020160005b50855180518254889392918391829060ff19166001838181116100005702179055506020820151816001015560408201518160020160006101000a815481600160a060020a030219169083600160a060020a0316021790555060608201518160030160006101000a815481600160a060020a030219169083600160a060020a031602179055506080820151816004019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610caf57805160ff1916838001178555610cdc565b82800160010185558215610cdc579182015b82811115610cdc578251825591602001919060010190610cc1565b5b50610cfd9291505b80821115610b755760008155600101610b61565b5090565b505060a08201516005909101805460c084015160e09094015167ffffffffffffffff90811660a860020a0260a860020a67ffffffffffffffff0219600160a060020a039096166101000261010060a860020a031995151560ff199094169390931794909416919091179390931691909117905560208381015160068401805491841667ffffffffffffffff1992831617905560408086015160078601556060909501516008909401805494909316931692909217905560028e0154825160001991909101815291517f959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef9350918290030190a15b5050505050505050505050565b60028201548110610e0d57610000565b8160020181815481101561000057906000526020600020906009020160005b815460ff191682556000600180840182905560028085018054600160a060020a0319908116909155600386018054909116905560048501805484825586949391929181161561010002600019011604601f819010610e8a5750610ebc565b601f016020900490600052602060002090810190610ebc91905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff199081169091556000600783015560089091018054909116905560028201805460001981019081101561000057906000526020600020906009020160005b508260020182815481101561000057906000526020600020906009020160005b50815481548391839160ff90911690829060ff1916600183818111610000570217905550600182810154828201556002808401548184018054600160a060020a03928316600160a060020a031991821617909155600380870154908601805491909316911617905560048085018054918501805460008281526020908190209296610100838216158102600019908101909416889004601f9081019390930485019791871615029092019094160492909190839010611000578054855561103c565b8280016001018555821561103c57600052602060002091601f016020900482015b8281111561103c578254825591600101919060010190611021565b5b5061105d9291505b80821115610b755760008155600101610b61565b5090565b50506005918201805491909201805460ff191660ff909216151591909117808255825461010060a860020a031990911661010091829004600160a060020a031690910217808255915460a860020a67ffffffffffffffff021990921660a860020a9283900467ffffffffffffffff908116909302179055600683810154908301805491831667ffffffffffffffff19928316179055600780850154908401556008938401549390920180549390911692909116919091179055600282018054600019810180835591908290801582901161122e5760090281600902836000526020600020918201910161122e91905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a031990811690915560038501805490911690556004840180548482558593859390821615610100026000190190911604601f8190106111b357506111e5565b601f0160209004906000526020600020908101906111e591905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff1990811690915560006007830155600882018054909116905560090161114c565b5090565b5b50506040805184815290517f24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e0189350908190036020019150a160028201548110156106df57600282015460408051918252517f24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e0189181900360200190a16040805182815290517f959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef9181900360200190a15b5b5050565b6106df826000343330866001611589565b5b5050565b6000600061130683611652565b9150816001015482600001540390506000811380156113285750816005015481135b1561138a5781600501548103826002018190555030600160a060020a031663635a43ca83600201546040518263ffffffff1660e060020a0281526004018090506000604051808303818588803b156100005761235a5a03f11561000057505050505b600682015460048301805467ffffffffffffffff8181169381169390930190921668010000000000000000026fffffffffffffffff000000000000000019909216919091179055600383015460408051918252517f5263beccfd97c2947207bf7254d7c0c216431d4b9cea8c9b3371e8187020851b9181900360200190a1600482015461142e90849068010000000000000000900467ffffffffffffffff16611680565b5b505050565b835460ff161561144357610000565b61144d8442611680565b61145984848484611498565b835460ff191660011784555b50505050565b61147c61147782611652565b61187d565b1561148a5761148a816112f9565b5b611494816118a3565b5b50565b826114a285611652565b6001015411156114b157610000565b6004840183905560058401805467ffffffffffffffff191667ffffffffffffffff84161790556006840181905561146584611ae2565b5b50505050565b6114ff846001853085876001611589565b604051600160a060020a0382169084156108fc029085906000818181858888f19350505050151561146557610000565b5b50505050565b6000600060008461010001518560800151019150836020015167ffffffffffffffff168460600151830367ffffffffffffffff16811561000057049050836000015160200151810292505b505092915050565b604080516101008082018352600080835260208084018290528385018290526060840182905284519081018552818152608084015260a0830181905260c0830181905260e083015282519081019092529080886001811161000057815260200187815260200186600160a060020a0316815260200185600160a060020a03168152602001848152602001831515815260200133600160a060020a031681526020014267ffffffffffffffff1681525090506116478882846001611b30565b5b5050505050505050565b6000816001018260030154815481101561000057906000526020600020906008020160005b5090505b919050565b6001808301805460038501819055918201808255600092909190829080158290116117f7576008028160080283600052602060002091820191016117f791905b80821115610b755760008082556001820181905560028201819055600382018054828255908252602082206117ab916006028101905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a03199081169091556003850180549091169055600484018054848255909281161561010002600019011604601f819010611758575061178a565b601f01602090049060005260206000209081019061178a91905b80821115610b755760008155600101610b61565b5090565b5b5050600581018054600160e860020a03191690556006016116f6565b5090565b5b505060048101805470ffffffffffffffffffffffffffffffffff1916905560006005820181905560068201805467ffffffffffffffff1916905560078201556008016116c0565b5090565b5b505050600384015460408051918252517f61a611267e7ed28f8a566b021b9ac3ccc3985343a31971a180d01a57f63f338092509081900360200190a161183d83611652565b60048101805467ffffffffffffffff191667ffffffffffffffff85161790556003840154909150600090111561142e5761142e83611ae2565b5b5b505050565b600681015460048201544267ffffffffffffffff9182169282169290920116105b919050565b6000805b600283015482101561142e578260020182815481101561000057906000526020600020906009020160005b50600681015460088201549192504267ffffffffffffffff918216928216929092011611611ad05760058101805460a860020a67ffffffffffffffff02191660a860020a4267ffffffffffffffff9081169190910291909117909155600682015460088301805467ffffffffffffffff1981169284169084160190921617905560038101546001820154604051600160a060020a03909216916108fc82150291906000818181858888f19350505050151561198c57610000565b6040805161010081019091528154611ac49185918490829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f81018490048402850184019091528084526080909401939091830182828015611a775780601f10611a4c57610100808354040283529160200191611a77565b820191906000526020600020905b815481529060010190602001808311611a5a57829003601f168201915b50505091835250506005919091015460ff8116151560208301526101008104600160a060020a0316604083015260a860020a900467ffffffffffffffff1660609091015260016000611b30565b60078101805460010190555b5b6001909101906118a7565b5b505050565b6000611aed82611652565b600483015460078201556005808401546006808401805467ffffffffffffffff191667ffffffffffffffff909316929092179091558401549082015590505b5050565b8015611b3f57611b3f8461146b565b5b8115611b5957611b5984611b5386611652565b85611e43565b5b611b6384611652565b6003018054806001018281815481835581811511611c4b57600602816006028360005260206000209182019101611c4b91905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a03199081169091556003850180549091169055600484018054848255909281161561010002600019011604601f819010611bf85750611c2a565b601f016020900490600052602060002090810190611c2a91905b80821115610b755760008155600101610b61565b5090565b5b5050600581018054600160e860020a0319169055600601611b96565b5090565b5b505050916000526020600020906006020160005b508451815486929190829060ff19166001838181116100005702179055506020820151816001015560408201518160020160006101000a815481600160a060020a030219169083600160a060020a0316021790555060608201518160030160006101000a815481600160a060020a030219169083600160a060020a031602179055506080820151816004019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10611d3457805160ff1916838001178555611d61565b82800160010185558215611d61579182015b82811115611d61578251825591602001919060010190611d46565b5b50611d829291505b80821115610b755760008155600101610b61565b5090565b505060a08201516005909101805460c084015160e09094015167ffffffffffffffff1660a860020a0260a860020a67ffffffffffffffff0219600160a060020a039095166101000261010060a860020a031994151560ff19909316929092179390931617929092161790555060038401547f62ad1f2c6191c79e31d5ee69f7a962dce559b92f2adf6fa27ecf13bee926a1a4906001611e2087611652565b600301546040805193845291900360208301528051918290030190a15b50505050565b6000815160018111610000571415611e64576020810151825401825561142e565b81600701548160200151611e78858561030e565b011115611e8457610000565b602081015160018301805490910190555b5b5050505600a165627a7a723058208b225e273171d8d076d25beedd7d5afda5c6bb2b712ac1412090d96c30cd16370029",
    "events": {
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
    "updated_at": 1486032053003,
    "links": {},
    "address": "0xbde75337b0351d0d76f121b8d54a77eb08ba8c62"
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "period",
            "type": "AccountingLib.AccountingPeriod storage"
          }
        ],
        "name": "getAccountingPeriodState",
        "outputs": [
          {
            "name": "remainingBudget",
            "type": "uint256"
          },
          {
            "name": "periodCloses",
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
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "period",
            "type": "AccountingLib.AccountingPeriod storage"
          }
        ],
        "name": "projectPeriodExpenses",
        "outputs": [
          {
            "name": "expenses",
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
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "addTreasure",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
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
            "name": "to",
            "type": "address"
          },
          {
            "name": "period",
            "type": "uint64"
          },
          {
            "name": "startNow",
            "type": "bool"
          }
        ],
        "name": "sendRecurringFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "removeRecurringTransaction",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "concept",
            "type": "string"
          }
        ],
        "name": "registerIncome",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          }
        ],
        "name": "closeCurrentPeriod",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
          {
            "name": "initialBudget",
            "type": "uint256"
          },
          {
            "name": "initialPeriodDuration",
            "type": "uint64"
          },
          {
            "name": "initialDividendThreshold",
            "type": "uint256"
          }
        ],
        "name": "init",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          }
        ],
        "name": "performDueTransactions",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
          },
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
        "constant": false,
        "inputs": [
          {
            "name": "self",
            "type": "AccountingLib.AccountingLedger storage"
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
            "name": "to",
            "type": "address"
          }
        ],
        "name": "sendFunds",
        "outputs": [],
        "payable": false,
        "type": "function"
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
    "unlinked_binary": "0x606060405234610000575b611ec7806100196000396000f300606060405236156100935763ffffffff60e060020a60003504166306285e56811461009857806309904546146100c85780633405829e146100e85780636186d6641461013957806369efe0f1146101af5780638135e059146101bf578063af0d20a514610210578063c1145d0d1461021d578063c3f0da0b1461023d578063c608c59d1461024a578063d5da0e711461026a575b610000565b6100a66004356024356102c9565b6040805192835267ffffffffffffffff90911660208301528051918290030190f35b6100d660043560243561030e565b60408051918252519081900360200190f35b60408051602060046024803582810135601f810185900485028601850190965285855261013795833595939460449493929092019181908401838280828437509496506106ce95505050505050565b005b604080516020600460443581810135601f810184900484028501840190955284845261013794823594602480359560649492939190920191819084018382808284375094965050600160a060020a038535169467ffffffffffffffff602082013516945060400135151592506106e4915050565b005b610137600435602435610dfd565b005b60408051602060046024803582810135601f810185900485028601850190965285855261013795833595939460449493929092019181908401838280828437509496506112e395505050505050565b005b6101376004356112f9565b005b61013760043560243567ffffffffffffffff60443516606435611434565b005b61013760043561146b565b005b61013760043560243567ffffffffffffffff60443516606435611498565b005b604080516020600460443581810135601f810184900484028501840190955284845261013794823594602480359560649492939190920191819084018382808284375094965050509235600160a060020a031692506114ee915050565b005b600060006102d68461146b565b6102e0848461030e565b60078401546006850154600486015492909103935067ffffffffffffffff91821691160190505b9250929050565b600181015460005b60028401548110156106c6576106b983610140604051908101604052908160008201548152602001600182015481526020016002820154815260200160038201805480602002602001604051908101604052809291908181526020016000905b828210156104d1576000848152602081206006840201905b506040805161010081019091528154909190829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156104755780601f1061044a57610100808354040283529160200191610475565b820191906000526020600020905b81548152906001019060200180831161045857829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a0316604084015260a860020a90910467ffffffffffffffff166060909201919091529082526001929092019101610376565b50505090825250600482015467ffffffffffffffff808216602084015268010000000000000000820481166040840152608060020a90910460ff16151560608301526005830154608083015260068301541660a082015260079091015460c090910152600286018054849081101561000057906000526020600020906009020160005b506040805161018081019091528154909190829060808201908390829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156106445780601f1061061957610100808354040283529160200191610644565b820191906000526020600020905b81548152906001019060200180831161062757829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a031660408085019190915260a860020a90920467ffffffffffffffff908116606094850152938552600686015484169085015260078501549084015260089093015416910152611536565b820191505b600101610316565b5b5092915050565b6106df826000343330866000611589565b5b5050565b6040805161010080820183526000808352602080840182905283850182905260608085018390528551808301875283815260808087019190915260a080870185905260c080880186905260e0978801869052885161026081018a52610160810187815261018082018890526101a082018890526101c082018890528a518088018c528881526101e08301526102008201889052610220820188905261024082018890528152808601879052808a0187905284018690528851968701895260018088528786018f9052600160a060020a03308116898c01528d8116898701528885018f90529288015233909116908601529484018390528551948501865283855267ffffffffffffffff8881169286019290925294840182905242169383019390935291808085156108255760608401805188900367ffffffffffffffff1690525b6108688b6001604060405190810160405280601c81526020017f74657374696e672069742063616e2072656365697665206d6f6e6579000000008152508b6114ee565b6108718b611652565b925061087d8b8461030e565b9150610a9783610140604051908101604052908160008201548152602001600182015481526020016002820154815260200160038201805480602002602001604051908101604052809291908181526020016000905b82821015610a2e576000848152602081206006840201905b506040805161010081019091528154909190829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f810184900484028501840190915280845260809094019390918301828280156109d25780601f106109a7576101008083540402835291602001916109d2565b820191906000526020600020905b8154815290600101906020018083116109b557829003601f168201915b50505091835250506005919091015460ff811615156020808401919091526101008204600160a060020a0316604084015260a860020a90910467ffffffffffffffff1660609092019190915290825260019290920191016108d3565b50505090825250600482015467ffffffffffffffff808216602084015268010000000000000000820481166040840152608060020a90910460ff16151560608301526005830154608083015260068301541660a082015260079091015460c09091015285611536565b905082600701548183011115610aac57610000565b8a6002018054806001018281815481835581811511610bc257600902816009028360005260206000209182019101610bc291905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a031990811690915560038501805490911690556004840180548482558593859390821615610100026000190190911604601f819010610b475750610b79565b601f016020900490600052602060002090810190610b7991905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff19908116909155600060078301556008820180549091169055600901610ae0565b5090565b5b505050916000526020600020906009020160005b50855180518254889392918391829060ff19166001838181116100005702179055506020820151816001015560408201518160020160006101000a815481600160a060020a030219169083600160a060020a0316021790555060608201518160030160006101000a815481600160a060020a030219169083600160a060020a031602179055506080820151816004019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610caf57805160ff1916838001178555610cdc565b82800160010185558215610cdc579182015b82811115610cdc578251825591602001919060010190610cc1565b5b50610cfd9291505b80821115610b755760008155600101610b61565b5090565b505060a08201516005909101805460c084015160e09094015167ffffffffffffffff90811660a860020a0260a860020a67ffffffffffffffff0219600160a060020a039096166101000261010060a860020a031995151560ff199094169390931794909416919091179390931691909117905560208381015160068401805491841667ffffffffffffffff1992831617905560408086015160078601556060909501516008909401805494909316931692909217905560028e0154825160001991909101815291517f959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef9350918290030190a15b5050505050505050505050565b60028201548110610e0d57610000565b8160020181815481101561000057906000526020600020906009020160005b815460ff191682556000600180840182905560028085018054600160a060020a0319908116909155600386018054909116905560048501805484825586949391929181161561010002600019011604601f819010610e8a5750610ebc565b601f016020900490600052602060002090810190610ebc91905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff199081169091556000600783015560089091018054909116905560028201805460001981019081101561000057906000526020600020906009020160005b508260020182815481101561000057906000526020600020906009020160005b50815481548391839160ff90911690829060ff1916600183818111610000570217905550600182810154828201556002808401548184018054600160a060020a03928316600160a060020a031991821617909155600380870154908601805491909316911617905560048085018054918501805460008281526020908190209296610100838216158102600019908101909416889004601f9081019390930485019791871615029092019094160492909190839010611000578054855561103c565b8280016001018555821561103c57600052602060002091601f016020900482015b8281111561103c578254825591600101919060010190611021565b5b5061105d9291505b80821115610b755760008155600101610b61565b5090565b50506005918201805491909201805460ff191660ff909216151591909117808255825461010060a860020a031990911661010091829004600160a060020a031690910217808255915460a860020a67ffffffffffffffff021990921660a860020a9283900467ffffffffffffffff908116909302179055600683810154908301805491831667ffffffffffffffff19928316179055600780850154908401556008938401549390920180549390911692909116919091179055600282018054600019810180835591908290801582901161122e5760090281600902836000526020600020918201910161122e91905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a031990811690915560038501805490911690556004840180548482558593859390821615610100026000190190911604601f8190106111b357506111e5565b601f0160209004906000526020600020908101906111e591905b80821115610b755760008155600101610b61565b5090565b5b50506005018054600160e860020a03191690555060068101805467ffffffffffffffff1990811690915560006007830155600882018054909116905560090161114c565b5090565b5b50506040805184815290517f24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e0189350908190036020019150a160028201548110156106df57600282015460408051918252517f24ef25c67e85ad3acf87f62ecbe1b5fa3641cf54972aec7bf8cd1a507563e0189181900360200190a16040805182815290517f959c5b77f561a2d4015cca5a9e954873b86ae486f7d28c079c9f4eb85269b2ef9181900360200190a15b5b5050565b6106df826000343330866001611589565b5b5050565b6000600061130683611652565b9150816001015482600001540390506000811380156113285750816005015481135b1561138a5781600501548103826002018190555030600160a060020a031663635a43ca83600201546040518263ffffffff1660e060020a0281526004018090506000604051808303818588803b156100005761235a5a03f11561000057505050505b600682015460048301805467ffffffffffffffff8181169381169390930190921668010000000000000000026fffffffffffffffff000000000000000019909216919091179055600383015460408051918252517f5263beccfd97c2947207bf7254d7c0c216431d4b9cea8c9b3371e8187020851b9181900360200190a1600482015461142e90849068010000000000000000900467ffffffffffffffff16611680565b5b505050565b835460ff161561144357610000565b61144d8442611680565b61145984848484611498565b835460ff191660011784555b50505050565b61147c61147782611652565b61187d565b1561148a5761148a816112f9565b5b611494816118a3565b5b50565b826114a285611652565b6001015411156114b157610000565b6004840183905560058401805467ffffffffffffffff191667ffffffffffffffff84161790556006840181905561146584611ae2565b5b50505050565b6114ff846001853085876001611589565b604051600160a060020a0382169084156108fc029085906000818181858888f19350505050151561146557610000565b5b50505050565b6000600060008461010001518560800151019150836020015167ffffffffffffffff168460600151830367ffffffffffffffff16811561000057049050836000015160200151810292505b505092915050565b604080516101008082018352600080835260208084018290528385018290526060840182905284519081018552818152608084015260a0830181905260c0830181905260e083015282519081019092529080886001811161000057815260200187815260200186600160a060020a0316815260200185600160a060020a03168152602001848152602001831515815260200133600160a060020a031681526020014267ffffffffffffffff1681525090506116478882846001611b30565b5b5050505050505050565b6000816001018260030154815481101561000057906000526020600020906008020160005b5090505b919050565b6001808301805460038501819055918201808255600092909190829080158290116117f7576008028160080283600052602060002091820191016117f791905b80821115610b755760008082556001820181905560028201819055600382018054828255908252602082206117ab916006028101905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a03199081169091556003850180549091169055600484018054848255909281161561010002600019011604601f819010611758575061178a565b601f01602090049060005260206000209081019061178a91905b80821115610b755760008155600101610b61565b5090565b5b5050600581018054600160e860020a03191690556006016116f6565b5090565b5b505060048101805470ffffffffffffffffffffffffffffffffff1916905560006005820181905560068201805467ffffffffffffffff1916905560078201556008016116c0565b5090565b5b505050600384015460408051918252517f61a611267e7ed28f8a566b021b9ac3ccc3985343a31971a180d01a57f63f338092509081900360200190a161183d83611652565b60048101805467ffffffffffffffff191667ffffffffffffffff85161790556003840154909150600090111561142e5761142e83611ae2565b5b5b505050565b600681015460048201544267ffffffffffffffff9182169282169290920116105b919050565b6000805b600283015482101561142e578260020182815481101561000057906000526020600020906009020160005b50600681015460088201549192504267ffffffffffffffff918216928216929092011611611ad05760058101805460a860020a67ffffffffffffffff02191660a860020a4267ffffffffffffffff9081169190910291909117909155600682015460088301805467ffffffffffffffff1981169284169084160190921617905560038101546001820154604051600160a060020a03909216916108fc82150291906000818181858888f19350505050151561198c57610000565b6040805161010081019091528154611ac49185918490829060ff16600181116100005760018111610000578152600182810154602080840191909152600280850154600160a060020a039081166040808701919091526003870154909116606086015260048601805482516101009682161596909602600019011692909204601f81018490048402850184019091528084526080909401939091830182828015611a775780601f10611a4c57610100808354040283529160200191611a77565b820191906000526020600020905b815481529060010190602001808311611a5a57829003601f168201915b50505091835250506005919091015460ff8116151560208301526101008104600160a060020a0316604083015260a860020a900467ffffffffffffffff1660609091015260016000611b30565b60078101805460010190555b5b6001909101906118a7565b5b505050565b6000611aed82611652565b600483015460078201556005808401546006808401805467ffffffffffffffff191667ffffffffffffffff909316929092179091558401549082015590505b5050565b8015611b3f57611b3f8461146b565b5b8115611b5957611b5984611b5386611652565b85611e43565b5b611b6384611652565b6003018054806001018281815481835581811511611c4b57600602816006028360005260206000209182019101611c4b91905b80821115610b7557805460ff191681556000600180830182905560028084018054600160a060020a03199081169091556003850180549091169055600484018054848255909281161561010002600019011604601f819010611bf85750611c2a565b601f016020900490600052602060002090810190611c2a91905b80821115610b755760008155600101610b61565b5090565b5b5050600581018054600160e860020a0319169055600601611b96565b5090565b5b505050916000526020600020906006020160005b508451815486929190829060ff19166001838181116100005702179055506020820151816001015560408201518160020160006101000a815481600160a060020a030219169083600160a060020a0316021790555060608201518160030160006101000a815481600160a060020a030219169083600160a060020a031602179055506080820151816004019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10611d3457805160ff1916838001178555611d61565b82800160010185558215611d61579182015b82811115611d61578251825591602001919060010190611d46565b5b50611d829291505b80821115610b755760008155600101610b61565b5090565b505060a08201516005909101805460c084015160e09094015167ffffffffffffffff1660a860020a0260a860020a67ffffffffffffffff0219600160a060020a039095166101000261010060a860020a031994151560ff19909316929092179390931617929092161790555060038401547f62ad1f2c6191c79e31d5ee69f7a962dce559b92f2adf6fa27ecf13bee926a1a4906001611e2087611652565b600301546040805193845291900360208301528051918290030190a15b50505050565b6000815160018111610000571415611e64576020810151825401825561142e565b81600701548160200151611e78858561030e565b011115611e8457610000565b602081015160018301805490910190555b5b5050505600a165627a7a723058208b225e273171d8d076d25beedd7d5afda5c6bb2b712ac1412090d96c30cd16370029",
    "events": {
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
    "updated_at": 1486036778437,
    "links": {},
    "address": "0x36eed73ca021b17024b75c29e6d86f588c15ce53"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "AccountingLib";
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
    window.AccountingLib = Contract;
  }
})();
