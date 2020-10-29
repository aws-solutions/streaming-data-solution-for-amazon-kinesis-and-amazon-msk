# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2020-10-29
### Added
- Pattern for Amazon Kinesis Data Streams, Amazon Kinesis Data Firehose, and Amazon S3, which can be used when you want a simple way to back up incoming streaming data. Kinesis Data Firehose automatically takes care of compression and encryption, minimizing the amount of storage used at the destination and increasing security.
- Pattern for Amazon Kinesis Data Streams, Amazon Kinesis Data Analytics, and Amazon API Gateway, which can be used when you have a streaming application that needs to (asynchronously) invoke an external endpoint (for instance, to filter or enrich events). The interaction with the external system is made via the [Asynchronous I/O API of Apache Flink](https://ci.apache.org/projects/flink/flink-docs-stable/dev/stream/operators/asyncio.html).

### Changed
- The CloudWatch dashboard created for each pattern now includes CloudWatch alarms as widgets. Previously, to see the status of each alarm, you'd have to go to the Alarms page of the CloudWatch console.
- The Kinesis Analytics application CDK construct has been refactored, and it now accepts [runtime properties](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-properties.html) as parameters. Previously, the construct always expected to read from a Kinesis Data Stream and write to an S3 bucket, but now it can be used for more use cases.

### Fixed
- Resolved serialization issue with anonymous metrics

## [1.1.0] - 2020-09-17
### Changed
- Amazon Kinesis Data Analytics and AWS Lambda roles to use inline policies
- Demo application artifact names not to include version
- API Gateway and AWS Lambda pattern to use [AWS Solutions Constructs](https://aws.amazon.com/solutions/constructs/)

## [1.0.0] - 2020-08-31
### Added
- Pattern for Amazon API Gateway, Amazon Kinesis Data Streams, and AWS Lambda
- Pattern for Kinesis Producer Library, Amazon Kinesis Data Streams, and Amazon Kinesis Data Analytics
