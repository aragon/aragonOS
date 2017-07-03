#!/bin/bash
#set -x
set -e

# Define help message
show_help() {
    echo """
    Commands
    test          : runs test suite
    start         : start server
    bash          : bash prompt in container
    help          : show this help
    """
}

lint_test() {
    # TODO: add linter
    cd /usr/src/app
    npm t
}

case "$1" in
    test)
        lint_test
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
