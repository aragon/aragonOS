#! /bin/bash

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the testrpc instance that we started (if we started one).
  if [ -n "$testrpc_pid" ]; then
    kill -9 $testrpc_pid
  fi
}

testrpc_running() {
  nc -z localhost 8555
}

if testrpc_running; then
  echo "Using existing testrpc-sc instance"
else
  echo "Starting testrpc-sc to generate coverage"
  ./node_modules/ethereumjs-testrpc-sc/build/cli.node.js --gasLimit 0xfffffffffff --port 8555 > /dev/null &
  testrpc_pid=$!
fi

SOLIDITY_COVERAGE=true ./node_modules/.bin/solidity-coverage

