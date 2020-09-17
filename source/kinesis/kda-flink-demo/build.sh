#!/bin/bash
#
# Parameters:
#  - zip_path: Location where the zipped artifacts will be stored.

[ "$DEBUG" == 'true' ] && set -x
set -e

# Check to see if input has been provided:
if [ -z "$1" ]; then
    echo "Please provide the location where the zipped artifacts will be stored"
    echo "For example: ./build.sh kda-flink-demo.zip"
    exit 1
fi

zip_path="$1"
flink_version=1.8.2
flink_checksum="7451cafb920f954e851fad2bcb551c9dc24af0615a70c78f932455b260832a434893548de5058609c22d251d2e4c2a3bc6c1c2d2f93c7811b481651d2877d34b flink-$flink_version-src.tgz"

wget https://archive.apache.org/dist/flink/flink-$flink_version/flink-$flink_version-src.tgz
echo $flink_checksum | sha512sum -c

tar -xf flink-$flink_version-src.tgz
cd flink-$flink_version
mvn clean install --quiet -Pinclude-kinesis -DskipTests -Dfast --projects flink-connectors/flink-connector-kinesis,flink-connectors/flink-connector-kafka

cd $OLDPWD
mvn clean package --quiet -Dflink.version=$flink_version
zip -jq9 $zip_path target/aws-kda-flink-demo.jar
