#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# check for coverage which will specify new port for ethereum client
if [ "$SOLIDITY_COVERAGE" = true ]; then
    geth_port=8555
else
    geth_port=8545
fi

DEFAULT_ACCOUNTS=5
DEFAULT_PASSWORD=""

PARITY_VERSION=v1.8.6
GETH_VERSION=latest

client_running() {
    nc -z localhost "$geth_port"
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
        echo `$DEFAULT_PASSWORD` > ~/.accountpassword
    fi

    # enforce datadir and networkid parameters to run geth locally using private network
    if [ -z "$DATADIR" || -z $GETH_NETWORKID ]; then
        echo "Error: missing DATADIR or GETH_NETWORKID environment variable(s)"
    fi
    # create a primary account
    if [ ! -f ~/.primaryaccount ]; then
        geth --datadir $DATADIR --password ~/.accountpassword account new > ~/.primaryaccount
    fi

    # init genesis block for private network
    geth --datadir $DATADIR init genesis.json
    geth --datadir $DATADIR --rpc --unlock "0" --password ~/.accountpassword \
    --rpccorsdomain "*" --rpcaddr "0.0.0.0" --mine --minerthreads 1 \
    --rpcport "$geth_port" --targetgaslimit 9000000 --nodiscover --networkid $GETH_NETWORKID &

    rpc_pid=$!
}

start_parity() {
    IFS=$'\n' addresses=($(parity account list --chain dev))

    echo $addresses

    if [ ${#addresses[@]} -lt 1 ]; then
        echo "No parity accounts found, creating ($DEFAULT_ACCOUNTS) default accounts"
        echo "(default password: \"$DEFAULT_PASSWORD\")"

        for (( i = 0; i < $DEFAULT_ACCOUNTS; i++ )); do
            echo "$DEFAULT_PASSWORD\n$DEFAULT_PASSWORD\n" | parity account new --chain dev
        done

        echo "Creating password file for default accounts..."
        if [ -e $1 ]; then
            echo "'password' file already exists" >&2
        fi

        for (( i = 0; i < $DEFAULT_ACCOUNTS; i++ )); do
            echo "$DEFAULT_PASSWORD" >> password
        done
    else
        parity --chain dev \
        --author ${addresses[2]} \
        --unlock ${addresses[0]},${addresses[1]},${addresses[2]} \
        --password ./password --geth --no-dapps \
        --tx-gas-limit 0x5F5E100 --gasprice 0x0 --gas-floor-target 0x47E7C4 \
        --reseal-on-txs all --reseal-min-period 0 \
        --jsonrpc-interface all --jsonrpc-hosts all --jsonrpc-cors="http://localhost:$geth_port" &

        rpc_pid=$!
    fi
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
    --chain dev --jsonrpc-interface all --jsonrpc-hosts all --geth \
    --tx-gas-limit 0x5F5E100
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
