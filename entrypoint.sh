#!/bin/bash
#set -x
set -e


export PATH=$PATH:/usr/src/app/node_modules/.bin/


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

run_coverage(){
    cd /usr/src/app
    npm run coverage
}

case "$1" in
    test)
        lint_test
    ;;
    coveralls)
        run_coveralls
    ;;
    coverage)
        run_coverage
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
