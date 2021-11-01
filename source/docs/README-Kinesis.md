## Architecture for AWS Streaming Data Solution for Amazon Kinesis
The solution implements four patterns with more coming soon. All of them use Amazon Kinesis Data Streams for streaming storage, and you can combine and extend the different components (which are built using the AWS CDK) to meet your needs.

### 1st pattern
![pattern-01](apigw-kds-lambda.png)

The first pattern includes an API Gateway REST API that acts as proxy to Kinesis; an Amazon Kinesis Data Stream that stores the data records; an AWS Lambda function that processes records from the data stream; and an Amazon SQS queue that stores metadata about failed records. Also included are [Amazon CloudWatch alarms](https://docs.aws.amazon.com/streams/latest/dev/monitoring-with-cloudwatch.html#kinesis-metric-use) and a dashboard to monitor the data stream health.

![cw-dashboard](kds-cw-dashboard.png)

### 2nd pattern
![pattern-02](kpl-kds-kda.png)

The second pattern includes an EC2 instance that generates data using the Kinesis Producer Library; an Amazon Kinesis Data Stream that stores the data records; an Amazon Kinesis Data Analytics Studio notebook that can be used to process the incoming records and save them to an Amazon S3 bucket.

The solution provides a [demo producer application](/source/kinesis/kpl-demo), which is configured to write 100 records per second to the data stream. The schema used is the same one provided in [Getting Started with Amazon Kinesis Data Analytics for Apache Flink (DataStream API)](https://docs.aws.amazon.com/kinesisanalytics/latest/java/getting-started.html):

```json
{
    "event_time": "2020-08-01 12:00:00.000",
    "ticker": "AMZN",
    "price": 50
}
```

By default, the demo producer application will not run after the stacks are created. To enable it, follow the steps below:

#### 1. Start the Kinesis Data Analytics Studio notebook
> **Note**: Studio notebook name is an output of the CloudFormation stack.

```
aws kinesisanalyticsv2 start-application --application-name <studio-notebook-name>
```

#### 2. Start the KPL producer
> **Note**: This command needs to be run from the EC2 instance launched as part of the stack.

> **Note**: Stream name is an output of the CloudFormation stack.

```
sudo java -jar /tmp/aws-kpl-demo.jar <stream-name> <aws-region> <seconds-to-run>
```

#### 3. Run SQL queries
```sql
%flink.ssql
CREATE TABLE stock_table (
    ticker VARCHAR(6),
    price DOUBLE,
    event_time TIMESTAMP(3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kinesis',
    'stream' = '<STREAM-NAME>',
    'aws.region' = '<AWS-REGION>',
    'scan.stream.initpos' = 'LATEST',
    'format' = 'json'
);
```

> **Note**: In order to write records to S3, you need to [enable checkpointing](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-zeppelin-checkpoint.html).

```python
%flink.pyflink
st_env.get_config().get_configuration().set_string(
    "execution.checkpointing.interval", "1min"
)

st_env.get_config().get_configuration().set_string(
    "execution.checkpointing.mode", "EXACTLY_ONCE"
)
```

> **Note**: This pattern creates an Amazon S3 bucket, and its name is an output of the CloudFormation stack.

```sql
%flink.ssql(type=update)
CREATE TABLE sink_table_s3 (event_time TIMESTAMP, ticker STRING, price DOUBLE, dt STRING, hr STRING)
PARTITIONED BY (ticker, dt, hr)
WITH ('connector' = 'filesystem', 'path' = 's3a://<BUCKET_NAME>/', 'format' = 'json');

INSERT INTO sink_table_s3
SELECT
    event_time,
    ticker,
    price,
    DATE_FORMAT(event_time, 'yyyy-MM-dd') as dt,
    DATE_FORMAT(event_time, 'HH') as hh
FROM stock_table
WHERE price > 50;
```

### 3rd pattern
![pattern-03](kds-kdf-s3.png)

The third pattern includes an Amazon Kinesis Data Stream that stores the data records; an Amazon Kinesis Data Firehose delivery stream that buffers data before delivering it to the destination; and an Amazon S3 bucket that stores the output. Also included are [Amazon CloudWatch alarms](https://docs.aws.amazon.com/firehose/latest/dev/monitoring-with-cloudwatch-metrics.html#firehose-cloudwatch-metrics-best-practices) and a dashboard to monitor the delivery stream health.

![cw-dashboard](kdf-cw-dashboard.png)

### 4th pattern
![pattern-04](kds-kda-apigw.png)

The fourth pattern is similar to the second pattern, but it showcases how to (asynchronously) invoke an external endpoint in a streaming application, which is useful when you want to enrich or filter incoming events. By default, the solution will use a Lambda function, but that can be replaced by any integration supported by API Gateway (such as an [Amazon SageMaker endpoint](https://docs.aws.amazon.com/solutions/latest/constructs/aws-apigateway-sagemakerendpoint.html)).

The solution provides a [demo producer application](https://github.com/aws-samples/amazon-kinesis-replay), which will replay events from an [existing dataset](https://registry.opendata.aws/nyc-tlc-trip-records-pds/) to the data stream. There's also a [demo Java application for Kinesis Data Analytics](/source/kinesis/kda-flink-ml), in order to demonstrate how to the [Asynchronous I/O API of Apache Flink](https://ci.apache.org/projects/flink/flink-docs-stable/dev/stream/operators/asyncio.html).

By default, the demo producer and consumer applications will not run after the stacks are created. To enable them, follow the steps below:

#### 1. Start the Kinesis Data Analytics application
> **Note**: Application name is an output of the CloudFormation stack.

```
aws kinesisanalyticsv2 start-application --application-name <application-name> --run-configuration {}
```

#### 2. Start the producer
> **Note**: This command needs to be run from the EC2 instance launched as part of the stack.

> **Note**: Stream name is an output of the CloudFormation stack.

```
sudo java -jar /tmp/amazon-kinesis-replay-0.1.0.jar -streamName <stream-name> -streamRegion <region> -noWatermark -objectPrefix artifacts/kinesis-analytics-taxi-consumer/taxi-trips-partitioned.json.lz4/dropoff_year=2018/
```
