#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# check for coverage which will specify new port for ethereum client
if [ "$SOLIDITY_COVERAGE" = true ]; then
    GETH_PORT=8555
else
    GETH_PORT=8545
fi

PARITY_VERSION=latest
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
    docker pull augurproject/dev-node-instant:$PARITY_VERSION
    # run the container in detached mode
    docker run -d -p 8545:8545 augurproject/dev-node-instant:$PARITY_VERSION
}

start_geth() {
    check_docker
    # pull the latest image using the dev test network
    docker pull ethereum/client-go:$GETH_VERSION
    # run the geth dev network container
    docker run -d -p 8545:8545 ethereum/client-go:$GETH_VERSION \
    --rpc --rpcport 8545 --rpcaddr '0.0.0.0' --rpccorsdomain '*' --dev --dev.period 1 --targetgaslimit 10000000

    echo "Allowing network to approach target gas limit..."
    sleep 300
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
