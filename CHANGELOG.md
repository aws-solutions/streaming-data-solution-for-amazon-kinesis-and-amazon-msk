# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.6] - 2024-12-05

### Security

 - Patched 3rd party security vulnerabilities

## [1.9.5] - 2024-10-17

### Security

- Patched commons-io and avro vulnerabilities

## [1.9.4] - 2024-10-03

### Security

- Patched protobuf-java vulnerability

## [1.9.3] - 2024-09-19

### Security

- Patched path-to-regex and micromatch vulnerabilities

## [1.9.2] - 2024-08-05

### Security

- Patched fast-xml-parser vulnerability

## [1.9.1] - 2024-06-13

### Added

- Onboarded to CloudFormation Guard scanning

### Fixed

- Upgraded and patched dependencies

## [1.9.0] - 2024-02-21

### Added

- Encrypt Glue Data Catalog data at-rest
- Add custom CloudWatch dashboard

### Fixed

- Fix SASL authentication deployment
- Upgrade MSK to 3.5.1
- Upgrade Apache Flink to Flink 1.15
- Upgrade Lambda Functions to Python 3.12 and NodeJS 20
- Patch security vulnerabilities

## [1.8.1] - 2023-10-18

### Fixed

- Patch critical security vulnerabilities

## [1.8.0] - 2023-09-14

### Fixed

- Migrate to AWS SDKv3
- Migrate to CDKv2
- Migrate Lambda functions to NodeJS 18 and Python 3.10 runtime
- npm package security patching

## [1.7.8] - 2023-07-13

### Fixed

- Set urllib3 version to address security issue
- Remove vm2 dependency
- Patch word-wrap and tough-cookie vulnerability

## [1.7.7] - 2023-06-14

### Fixed

- python package security patching - (`requests` bumped to v2.31.0)
- Changed logical ID of AWS AppRegistry application and attribute group

## [1.7.6] - 2023-05-16

### Fixed

- npm package security patching (vm2)

## [1.7.5] - 2023-04-20

### Fixed

- npm package security patching (vm2)

## [1.7.4] - 2023-04-18

### Fixed

- Updated the bucket policy on the logging bucket to grant access to the logging service principal (logging.s3.amazonaws.com) for access log delivery.
- Updated `org.json` package to address security issues

## [1.7.3] - 2023-04-13

### Fixed

- Update AWS-SDK V2 that addresses the security issue identified in [xml2js](https://github.com/aws/aws-sdk-js/issues/4387)

## [1.7.2] - 2023-01-10

### Fixed

- npm package security patching (json5)
- python security patching (requests)

## [1.7.1] - 2022-12-19

### Fixed

- Fixes [Issue #74](https://github.com/aws-solutions/streaming-data-solution-for-amazon-kinesis-and-amazon-msk/issues/74).
- AppRegistry application name now has 'App' prepended to it, to prevent any failures if the stack name starts with 'AWS'.
- AppRegistry `AttributeGroup` name now has 'AttrGrp` prepended, to prevent any stack deployment failures if stack names begins with 'AWS'.
- `npm` package security patching

## [1.7.0] - 2022-11-17

### Fixed

- [AWS Service Catalog AppRegistry](https://docs.aws.amazon.com/servicecatalog/latest/arguide/intro-app-registry.html) integration. When a stack is deployed, an Service Catalog application is created where all associated resources collections and attribute groups can be viewed.
- To monitor costs of resources used by the stack, the tag `AppManagerCFNStackKey` is added to the solution by AWS Systems Manager Application Manager.
- npm package security patching (minimatch)

## [1.6.2] - 2022-09-28

### Fixed

- npm package security patching (vm2)

## [1.6.1] - 2022-07-14

### Fixed

- npm package security patching (minimist, vm2)
- Gson 2.8.9

## [1.6.0] - 2021-11-01

### Added

- Support for [dynamic partitioning](https://aws.amazon.com/about-aws/whats-new/2021/08/introducing-dynamic-partitioning-amazon-kinesis-data-firehose/) in option 3 (Amazon Kinesis Data Streams, Amazon Kinesis Data Firehose, and Amazon S3). When enabled, dynamic partitioning allows for easy extraction of keys (for example, _customer_id_ or _transaction_id_) from incoming records and delivery of data grouped by these keys into corresponding S3 prefixes. Partitioning minimizes the amount of data scanned, optimizing performance and reducing costs of your analytics queries (using services such as Amazon Athena, Amazon EMR, or Amazon Redshift Spectrum).
- Support for Apache Kafka version 2.8.1. For a complete list of improvements and bug fixes, see the Apache Kafka release notes for [2.8.1](https://downloads.apache.org/kafka/2.8.1/RELEASE_NOTES.html).
- Support for clusters secured by IAM Access Control in option 2 (Amazon MSK and AWS Lambda) and option 3 (Amazon MSK, AWS Lambda, and Amazon Kinesis Data Firehose).

### Changed

- Option 2 (Kinesis Producer Library, Amazon Kinesis Data Streams, and Amazon Kinesis Data Analytics) and option 4 (Amazon MSK, Amazon Kinesis Data Analytics, and Amazon S3) to use Amazon Kinesis Data Analytics Studio, which offers a serverless notebook to perform live data exploration and get results in seconds (using SQL, Python, or Scala). The notebooks are powered by [Apache Zeppelin](https://zeppelin.apache.org/) and use [Apache Flink](https://flink.apache.org/) as the processing engine.
- Amazon Kinesis Data Analytics resources to use [Apache Flink version 1.13](https://flink.apache.org/news/2021/05/03/release-1.13.0.html). Some capabilities in this release are: enhancements to the Table/SQL API, improved interoperability between the Table and DataStream APIs, and stateful operations using the Python Datastream API.
- AWS CDK and AWS Solutions Constructs to version 1.126.0

## [1.5.0] - 2021-07-27

### Added

- Support for [IAM access control](https://aws.amazon.com/about-aws/whats-new/2021/05/introducing-iam-access-control-amazon-msk/) when creating the Amazon MSK cluster. By using IAM Access Control, customers no longer need to build and run one-off access management systems to control client authentication and authorization for Apache Kafka.
- Support for [SASL/SCRAM authentication](https://aws.amazon.com/about-aws/whats-new/2020/09/amazon-msk-now-supports-sasl-scram-authentication-with-usernames-and-passwords-secured-by-aws-secrets-manager/) when creating the Amazon MSK cluster. Username and password credentials are stored in AWS Secrets Manager, you can reduce the overhead of maintaining a traditional Apache Kafka authentication system, including: auditing, updating, and rotating client credentials.
- Support for [SASL/SCRAM authentication](https://aws.amazon.com/about-aws/whats-new/2020/12/aws-lambda-now-supports-sasl-scram-authentication-for-functions-triggered-from-amazon-msk/) when configuring an AWS Lambda function to read data from Amazon MSK.
- Support for Apache Kafka version 2.7.1. For a complete list of improvements and bug fixes, see the Apache Kafka release notes for [2.7.1](https://downloads.apache.org/kafka/2.7.1/RELEASE_NOTES.html).

### Changed

- Authentication for Option 1 (Amazon API Gateway, Amazon Kinesis Data Streams, and AWS Lambda) to use [Amazon Cognito user pools](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html). Previously, the only option to invoke the APIs was using AWS IAM credentials, which are usually not available in mobile clients.
- AWS CDK and AWS Solutions Constructs to version 1.110.0

## [1.4.2] - 2021-07-20

### Fixed

- Location of GitHub repository for MSK Labs assets.

## [1.4.1] - 2021-04-28

### Added

- Support for Apache Kafka versions 2.8.0 and 2.6.2. For a complete list of improvements and bug fixes, see the Apache Kafka release notes for [2.8.0](https://downloads.apache.org/kafka/2.8.0/RELEASE_NOTES.html) and [2.6.2](https://downloads.apache.org/kafka/2.6.2/RELEASE_NOTES.html).

## [1.4.0] - 2021-04-12

### Added

- Templates to be used for the [Amazon MSK Labs](https://amazonmsk-labs.workshop.aws/en/) (under the `labs` folder). These assets are not published on the [solution landing page](https://aws.amazon.com/solutions/implementations/aws-streaming-data-solution-for-amazon-msk/), but instead are used during workshops (that provide customers with hands-on experience of the Amazon MSK service by learning its features, configurations, and ecosystem tools).
- New parameter (`EbsVolumeSize`) to the `aws-streaming-data-solution-for-msk` template, allowing customers to provide the size (in GiB) of the EBS volume for the broker nodes.
- Support for enhanced partition-level monitoring to the Amazon MSK cluster. When enabled, this monitoring level makes the following metrics available in Amazon CloudWatch (at an additional cost): `EstimatedTimeLag` and `OffsetLag`.

### Changed

- AWS Lambda functions to use the [Node.js 14.x runtime](https://aws.amazon.com/blogs/compute/node-js-14-x-runtime-now-available-in-aws-lambda/).
- AWS CDK and AWS Solutions Constructs to version 1.95.2

## [1.3.0] - 2021-01-28

### Added

- Support for Apache Kafka versions 2.7.0 and 2.6.1. For a complete list of improvements and bug fixes, see the Apache Kafka release notes for [2.7.0](https://downloads.apache.org/kafka/2.7.0/RELEASE_NOTES.html) and [2.6.1](https://downloads.apache.org/kafka/2.6.1/RELEASE_NOTES.html).
- Pattern for Amazon MSK, Amazon Kinesis Data Analytics, and Amazon S3. This option showcases how to read data from an Apache Kafka topic using the [Apache Flink Table API](https://ci.apache.org/projects/flink/flink-docs-stable/dev/table/), which can be used to interact with data in a stream using a relational model.

### Changed

- Maximum allowed data retention period for an Amazon Kinesis Data Stream (from 1 week to 1 year). With this change, you can process incoming records without having to move them into a different data store. You can also satisfy certain data retention regulations, including HIPAA and FedRAMP.
- Amazon Kinesis Data Analytics applications to use Apache Flink version 1.11. Some capabilities in this release are: improvements to the Table and SQL APIs, an improved memory model and RocksDB optimizations for increased application stability, and support for task manager stack traces in the Apache Flink Dashboard.
- Updated AWS CDK and AWS Solutions Constructs to version 1.80.0
- Delivery stream (in the pattern for Amazon MSK, AWS Lambda, and Amazon Kinesis Data Firehose) to use Server-Side Encryption (SSE) for data at rest.

## [1.0.0_amazon_msk] - 2020-11-24

### Added

- Pattern for a standalone Amazon MSK cluster. This template will create a cluster following best practices, such as sending broker logs to Amazon CloudWatch Logs; encryption at rest; encryption in transit among the broker nodes; and open monitoring with Prometheus enabled. It'll also include an Amazon EC2 instance that contains the Apache Kafka client libraries required to communicate with the cluster.
- Pattern for Amazon MSK and AWS Lambda, which can be used when you want to build a serverless application that consumes data from Apache Kafka topics. The default function is a Node.js application that logs the received messages, but it can be customized to your business needs.
- Pattern for Amazon MSK, AWS Lambda, and Amazon Kinesis Data Firehose. This option is intended for use cases when you need to backup messages from an Apache Kafka topic in Amazon MSK (for instance, to replay them). The data will be stored in Amazon S3, and can be analyzed with tools such as Amazon Athena and Amazon S3 Select.

### Changed

- Updated AWS CDK and AWS Solutions Constructs to version 1.74.0

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
