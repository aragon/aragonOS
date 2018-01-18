#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# check for coverage which will specify new port for ethereum client
if [ "$SOLIDITY_COVERAGE" = true ]; then
    GETH_PORT=8555
else
    GETH_PORT=8545
fi

PARITY_VERSION=v1.8.6
GETH_VERSION=v1.7.3

client_running() {
    nc -z localhost "$GETH_PORT"
}

start_testrpc() {
    if [ "$SOLIDITY_COVERAGE" = true ]; then
    node_modules/.bin/testrpc-sc -i 16 --gasLimit 0xfffffffffff --port "$GETH_PORT"  > /dev/null &
    else
    node_modules/.bin/ganache-cli -i 15 --gasLimit 7000000 > /dev/null &
    fi

    rpc_pid=$!
}

check_docker() {
    # check that docker exists before attempting to pull/run images
    if ! [ -x "$(command -v docker)" ]; then
        echo 'Error: docker is not installed' >&2
        exit 1
    fi
}

start_parity() {
    check_docker
    # pull the most stable release of parity
    docker pull parity/parity:$PARITY_VERSION
    # run the container in detached mode
    docker run -d -p 8545:8545 --name parity parity/parity:$PARITY_VERSION \
    --chain dev --jsonrpc-interface all --jsonrpc-hosts all \
    --tx-gas-limit 0x5F5E100 --gasprice 0x0 --gas-floor-target 0x47E7C \
    --reseal-on-txs all --reseal-min-period 0 --no-dapps \
    --jsonrpc-apis all -lrpc=trace
}

start_geth() {
    check_docker
    # pull the latest image using the dev test network
    docker pull purta/geth-devnet:$GETH_VERSION
    # run the geth dev network container
    docker run -d -p 8545:8545 purta/geth-devnet:$GETH_VERSION
}

if client_running; then
    echo "Using existing geth instance at port $GETH_PORT"
else
    echo "Starting our own ethereum client at port $GETH_PORT"
    case $GETH_CLIENT in
        geth )
            start_geth
            ;;
        parity )
            start_parity
            ;;
        * )
            echo "No ethereum client specified, using testrpc..."
            start_testrpc
            ;;
    esac
fi

sleep 5
