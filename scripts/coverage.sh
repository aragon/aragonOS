#! /bin/bash

SOLIDITY_COVERAGE=true sh scripts/testrpc.sh
SOLIDITY_COVERAGE=true ./node_modules/.bin/solidity-coverage
