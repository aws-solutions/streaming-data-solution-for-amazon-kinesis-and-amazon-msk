#!/bin/bash
#
# This script runs all tests for the root CDK project, as well as any microservices, Lambda functions, or dependency
# source code packages. These include unit tests, integration tests, and snapshot tests.

[ "$DEBUG" == 'true' ] && set -x
set -e

venv_folder="./v-env/"

setup_python_env() {
    if [ -d "$venv_folder" ]; then
        echo "Re-using Python venv in $venv_folder"
        return
    fi

    python3 -m venv $venv_folder
    source $venv_folder/bin/activate
    pip3 install -q -r requirements.txt -r requirements-test.txt
    deactivate
}

run_python_lambda_test() {
    lambda_name=$1
    echo "------------------------------------------------------------------------------"
    echo "[Test] Python Lambda: $lambda_name"
    echo "------------------------------------------------------------------------------"

    [ "${CLEAN:-true}" = "true" ] && rm -rf $venv_folder

    setup_python_env
    source $venv_folder/bin/activate

    mkdir -p $source_dir/test/coverage-reports
    coverage_report_path=$source_dir/test/coverage-reports/$lambda_name.coverage.xml
    echo "Coverage report path set to $coverage_report_path"

    coverage run --omit "*/site-packages/*" -m unittest discover
    coverage xml -o $coverage_report_path
    coverage report --show-missing
    if [ "$?" = "1" ]; then
        echo "(deployment/run-unit-tests.sh) ERROR: there is likely output above." 1>&2
        exit 1
    fi

	sed -i -e "s,<source>$source_dir,<source>source,g" $coverage_report_path

    deactivate

    if [ "${CLEAN:-true}" = "true" ]; then
        # Note: leaving $source_dir/test/coverage-reports to allow further processing of coverage reports
        rm -rf $venv_folder coverage .coverage
    fi
}

run_javascript_lambda_test() {
    lambda_name=$1
    echo "------------------------------------------------------------------------------"
    echo "[Test] Javascript Lambda: $lambda_name"
    echo "------------------------------------------------------------------------------"

    npm test
    if [ "$?" = "1" ]; then
        echo "(deployment/run-unit-tests.sh) ERROR: there is likely output above." 1>&2
        exit 1
    fi

    [ "${CLEAN:-true}" = "true" ] && rm -rf coverage/lcov-report
    mkdir -p $source_dir/test/coverage-reports/jest
    coverage_report_path=$source_dir/test/coverage-reports/jest/$lambda_name
    rm -fr $coverage_report_path
    mv coverage $coverage_report_path
}

run_cdk_project_test() {
    component_description=$1
    component_name=solutions-constructs
    echo "------------------------------------------------------------------------------"
    echo "[Test] $component_description"
    echo "------------------------------------------------------------------------------"

    [ "${CLEAN:-true}" = "true" ] && npm run clean
    npm ci
    npm run build
    npm run test -- -u

    if [ "$?" = "1" ]; then
        echo "(deployment/run-unit-tests.sh) ERROR: there is likely output above." 1>&2
        exit 1
    fi

    [ "${CLEAN:-true}" = "true" ] && rm -rf coverage/lcov-report
    mkdir -p $source_dir/test/coverage-reports/jest
    coverage_report_path=$source_dir/test/coverage-reports/jest/$component_name
    rm -fr $coverage_report_path
    mv coverage $coverage_report_path
}

# Save the current working directory and set source directory
starting_dir=$PWD
cd ../source
source_dir=$PWD
cd $source_dir

# Option to clean or not clean the unit test environment before and after running tests.
# The environment variable CLEAN has default of 'true' and can be overwritten by caller
# by setting it to 'false'. For instance:
#    $ CLEAN=false ./run-unit-tests.sh
CLEAN="${CLEAN:-true}"

# Test the CDK project
run_cdk_project_test "CDK - AWS Streaming Data Solution"

# Test the Lambda functions
cd $source_dir/lambda
for folder in */ ; do
    cd "$folder"
    function_name=${PWD##*/}

    if [ -e "requirements.txt" ]; then
        run_python_lambda_test $function_name
    elif [ -e "package.json" ]; then
        run_javascript_lambda_test $function_name
    fi

    cd ..
done

# Return to the source/ level where we started
cd $starting_dir
