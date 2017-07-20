#! /bin/bash

output=$(nc -z localhost 8555; echo $?)
[ $output -eq "0" ] && trpc_running=true
if [ ! $trpc_running ]; then
  echo "Starting testrpc-sc to generate coverage"
  # we give each account 1M ether, needed for high-value tests
  ./node_modules/ethereumjs-testrpc-sc/bin/testrpc --gasLimit 0xfffffffffffff --port 8555 > /dev/null &
  trpc_pid=$!
fi
SOLIDITY_COVERAGE=true && ./node_modules/.bin/solidity-coverage
