#!/bin/bash
#
# Parameters:
#  - zip_path: Location where the zipped artifacts will be stored.

[ "$DEBUG" == 'true' ] && set -x
set -e

# Check to see if input has been provided:
if [ -z "$1" ]; then
    echo "Please provide the location where the zipped artifacts will be stored"
    echo "For example: ./build.sh kpl-demo.zip"
    exit 1
fi

zip_path="$1"

mvn clean package --quiet
zip -jq9 $zip_path target/aws-kpl-demo.jar
