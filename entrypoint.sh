#!/bin/bash
#set -x
set -e

# Define help message
show_help() {
    echo """
    Commands
    test          : runs test suite
    bash          : bash prompt in container
    help          : show this help
    """
}

lint_test() {
    # TODO: add linter
    cd /usr/src/app
    npm t
}

run_coveralls() {
    cd /usr/src/app
    npm run coveralls
}

case "$1" in
    test)
        lint_test
    ;;
    coveralls)
        run_coveralls
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
