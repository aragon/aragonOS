#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# check for coverage which will specify new port for ethereum client
if [ "$SOLIDITY_COVERAGE" = true ]; then
    geth_port=8555
else
    geth_port=8545
fi

PARITY_VERSION=v1.8.6
GETH_VERSION=latest

client_running() {
    nc -z localhost "$geth_port"
}

generate_password () {
    openssl rand -base64 12
}

start_testrpc() {
    if [ "$SOLIDITY_COVERAGE" = true ]; then
    node_modules/.bin/testrpc-sc -i 16 --gasLimit 0xfffffffffff --port "$geth_port"  > /dev/null &
    else
    node_modules/.bin/ganache-cli -i 15 --gasLimit 7000000 > /dev/null &
    fi

    rpc_pid=$!
}

start_geth() {
    # Generate and store a wallet password
    if [ ! -f ~/.accountpassword ]; then
        generate_password > ~/.accountpassword
    fi

    # create a primary account
    if [ ! -f ~/.primaryaccount ]; then
        geth --password ~/.accountpassword account new > ~/.primaryaccount
    fi

    geth --rpc --password ~/.accountpassword \
    --rpccorsdomain "*" --rpcaddr "0.0.0.0" --mine --minerthreads 1 \
    --rpcport "$geth_port" --targetgaslimit 9000000 --dev &

    rpc_pid=$!
}

start_parity() {
    IFS=$'\n' addresses=($(parity account list --chain dev))

    echo $addresses

    if [ ${#addresses[@]} -lt 1 ]; then
        echo "No parity accounts found, creating default account"
        generate_password > ~/.accountpassword

        parity --chain dev account new --password ~/.accountpassword > ~/.accountaddress

        if [ $? -eq 0 ]; then
            echo "Account created succesfully:"
            cat ~/.accountaddress
            cat ~/.accountpassword
        fi
    fi

    # parity does not like aliases or env variables for password files so
    # we need to grab the absolute path of the password file
    PASSWORD_FILE=$(find ~ -name .accountpassword -maxdepth 1)

    # start parity client in the background
    parity --chain dev --geth \
    --tx-gas-limit 0x5F5E100 --gasprice 0x0 --gas-floor-target 0x47E7C4 \
    --reseal-on-txs all --reseal-min-period 0 --no-dapps \
    --jsonrpc-interface all --jsonrpc-hosts all --jsonrpc-cors="http://localhost:$geth_port" \
    --author ${addresses[0]} \
    --unlock ${addresses[0]} \
    --password $PASSWORD_FILE &

    rpc_pid=$!
}

check_docker() {
    # check that docker exists before attempting to pull/run images
    if ! [ -x "$(command -v docker)" ]; then
        echo 'Error: docker is not installed' >&2
    fi
}

docker_start_parity() {
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

docker_start_geth() {
    check_docker
    # pull the latest image using the dev test network
    docker pull kunstmaan/ethereum-geth-devnet:$GETH_VERSION
    # run the geth dev network container
    docker run -d -p 8545:8545 kunstmaan/ethereum-geth-devnet:$GETH_VERSION
}

if client_running; then
    echo "Using existing geth instance at port $geth_port"
else
    echo "Starting our own ethereum client at port $geth_port"
    case $GETH_CLIENT in
        geth )
            if [ "$DOCKER_ENABLED" = true ]; then
                docker_start_geth
            else
                start_geth
            fi
            ;;
        parity )
            if [ "$DOCKER_ENABLED" = true ]; then
                docker_start_parity
            else
                start_parity
            fi
            ;;
        * )
            echo "No ethereum client specified, using testrpc..."
            start_testrpc
            ;;
    esac
fi

sleep 5
