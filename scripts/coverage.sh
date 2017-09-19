#! /bin/bash

sh scripts/testrpc.sh
SOLIDITY_COVERAGE=true ./node_modules/.bin/solidity-coverage
