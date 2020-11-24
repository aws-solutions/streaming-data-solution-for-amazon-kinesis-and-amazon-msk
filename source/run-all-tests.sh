#!/bin/bash
#
# This script runs all tests for the root CDK project, as well as any microservices, Lambda functions, or dependency
# source code packages. These include unit tests, integration tests, and snapshot tests.

[ "$DEBUG" == 'true' ] && set -x
set -e

source_dir=$PWD
lambda_dir="$source_dir/lambda"

# Test the CDK project
npm ci && npm run test -- -u

cd "$lambda_dir/kds-lambda-consumer"
npm test

for custom_resource in "$lambda_dir/kda-vpc-config" "$lambda_dir/kds-enhanced-monitoring" "$lambda_dir/solution-helper" "$lambda_dir/msk-dashboard"; do
    cd $custom_resource
    venv_folder="./v-env/"

    python3 -m venv $venv_folder
    source $venv_folder/bin/activate
    pip3 install -q -r requirements.txt -r requirements-test.txt

    coverage run --omit "*/site-packages/*" -m unittest discover && coverage report
    deactivate
    cd $OLDPWD
done

cd $source_dir
