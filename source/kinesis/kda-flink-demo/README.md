# Demo consumer application
A consumer is an application that processes all data from a Kinesis data stream. This [demo](src/main/java/com/demo/SampleApplication.java) is built using [Apache Flink](https://flink.apache.org/) (a popular framework and engine for processing data streams), and can be deployed as an application in Amazon Kinesis Data Analytics.

> Kinesis Data Analytics provides the underlying infrastructure for your Apache Flink applications. It handles core capabilities like provisioning compute resources, parallel computation, automatic scaling, and application backups (implemented as checkpoints and snapshots). You can use the high-level Flink programming features (such as operators, sources, and sinks) in the same way that you use them when hosting the Flink infrastructure yourself.

## Apache Flink
The Apache Flink programming model is based on two components:
- **Data stream**: The structured representation of a continuous flow of data records.
- **Transformation operator**: Takes one or more data streams as input, and produces one or more data streams as output.

An application processes data by using a connector. Apache Flink uses the following types of connectors:
- **Source**: A connector used to read external data.
```java
// A sample connector that reads data from a stream named "InputStream" in the "us-east-1" region.
Properties inputProperties = new Properties();
inputProperties.setProperty(ConsumerConfigConstants.AWS_REGION, "us-east-1");
inputProperties.setProperty(ConsumerConfigConstants.STREAM_INITIAL_POSITION, "LATEST");

DataStream<String> input = env.addSource(new FlinkKinesisConsumer<>("InputStream", new SimpleStringSchema(), inputProperties));
```

- **Sink**: A connector used to write to external locations.
```java
// A sample sink that writes data to a stream named "OutputStream" in the "us-east-1" region.
Properties outputProperties = new Properties();
outputProperties.setProperty(ConsumerConfigConstants.AWS_REGION, region);
outputProperties.setProperty("AggregationEnabled", "false");

FlinkKinesisProducer<String> sink = new FlinkKinesisProducer<>(new SimpleStringSchema(), outputProperties);
sink.setFailOnError(true);
sink.setDefaultStream("OutputStream");
sink.setDefaultPartition("0");
```

- **Operator**: A connector used to process data within the application.
```java
// A sample operator that aggregates data using a tumbling window.
input.flatMap(new Tokenizer()) // Tokenizer for generating words
    .keyBy(0) // Logically partition the stream for each word
    .timeWindow(Time.seconds(5)) // Tumbling window definition
    .sum(1) // Sum the number of words per partition
    .map(value -> value.f0 + "," + value.f1.toString() + "\n")
    .addSink(sink);
```

## Modifying the application
The sample application is configured to use the same schema as the [KPL demo](/source/kinesis/kpl-demo). To customize it, follow the steps below:

> For more examples of creating and working with applications in Amazon Kinesis Data Analytics, see the [Apache Flink Code Examples](https://github.com/apache/flink/tree/master/flink-examples/flink-examples-streaming/src/main/java/org/apache/flink/streaming/examples) and [Amazon Kinesis Data Analytics Java Examples](https://github.com/aws-samples/amazon-kinesis-data-analytics-java-examples) respositories on GitHub.

### 1. Update the operator on the _main_ method
The sample application uses the _timeWindow_ operator to find the maximum value for each stock symbol over a 10-second window that slides by 5 seconds. You should update it for your use case.

### 2. (Optional) Update settings on the _createSource_ and _createDestination_ methods
By default, the sample application will read data from a Kinesis data stream and write the output to an Amazon S3 bucket (both values are passed as [runtime properties](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-properties.html)). The complete list of settings for the source (_FlinkKinesisConsumer_) and the sink (_StreamingFileSink_) can be found on [GitHub](https://github.com/apache/flink/tree/release-1.8/flink-connectors/flink-connector-kinesis/src/main/java/org/apache/flink/streaming/connectors/kinesis/config) and the [Apache Flink documentation](https://ci.apache.org/projects/flink/flink-docs-stable/dev/connectors/streamfile_sink.html), respectively.

### 3. Build the application using Apache Maven
> **Note**: In order for your application to use the Apache Flink Kinesis connector, you must download, compile, and install Apache Flink. This connector is used to consume data from a Kinesis stream used as an application source, or to write data to a Kinesis stream used for application output. For more information, see [Using the Apache Flink Kinesis Streams Connector](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-creating-apps.html#how-creating-apps-building-kinesis).

```
mvn clean package --quiet -Dflink.version=1.8.2
```
