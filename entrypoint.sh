#!/bin/bash
#set -x
set -e

# Define help message
show_help() {
    echo """
    Commands
    test          : runs linter & test suite
    start         : start server
    bash          : bash prompt in container
    help          : show this help
    """
}

lint_test() {
    cd /usr/src/app
    npm t
}

start() {
    cd /usr/src/app
    stunnel
    node build/server.js
}


case "$1" in
    test)
        lint_test
    ;;
    start)
        start
    ;;
    help)
        show_help
    ;;
    bash )
        exec bash "${@:2}"
    ;;
    *)
        show_help
    ;;
esac
