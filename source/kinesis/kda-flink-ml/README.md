# Demo consumer application
A consumer is an application that processes all data from a Kinesis data stream. This [demo](src/main/java/com/demo/StreamingJob.java) is built using [Apache Flink](https://flink.apache.org/) (a popular framework and engine for processing data streams), and can be deployed as an application in Amazon Kinesis Data Analytics. It is similar to the [other application](/source/kinesis/kda-flink-demo) available in this solution, but it showcases how to (asynchronously) invoke an external endpoint, which is useful when you want to enrich or filter incoming events.

## Asynchronous I/O for External Data Access
To access the external endpoint, the application leverages the [Asynchronous I/O API of Apache Flink](https://ci.apache.org/projects/flink/flink-docs-stable/dev/stream/operators/asyncio.html). Asynchronous interaction with the external system means that a single parallel function instance can handle many requests concurrently and receive the responses concurrently. The implementation of `RichAsyncFunction` is available on the [Sig4SignedHttpRequestAsyncFunction class](src/main/java/com/demo/operators/Sig4SignedHttpRequestAsyncFunction.java):

```java
public class Sig4SignedHttpRequestAsyncFunction<T> extends RichAsyncFunction<HttpRequest<T>, HttpResponse<T>> {
    @Override
    public void open(Configuration parameters) throws Exception { ... }

    @Override
    public void close() throws Exception { ... }

    @Override
    public void asyncInvoke(HttpRequest<T> request, ResultFuture<HttpResponse<T>> resultFuture) throws Exception { ... }
}
```

## Modifying the application
The sample application is configured to read events from an [existing dataset](https://registry.opendata.aws/nyc-tlc-trip-records-pds/) and invoke an endpoint to predict the fare amount. To customize it, follow the steps below:

> By default, the solution will use a Lambda function, but that can be replaced by any integration supported by API Gateway (such as an [Amazon SageMaker endpoint](https://docs.aws.amazon.com/solutions/latest/constructs/aws-apigateway-sagemakerendpoint.html)).

### 1. Add classes defining the incoming schema
There are two classes used for deserialization of incoming records: [Event](src/main/java/com/demo/events/Event.java) and [RideRequest](src/main/java/com/demo/events/RideRequest.java). You can use them as a reference for your use case.

### 2. Update the operators on the _main_ method
The sample application has several examples on how to handle HTTP requests and responses. You should update them (or use them as reference) for your use case.

### 3. (Optional) Update settings on the _createSource_ methods
By default, the sample application will read data from a Kinesis data stream and invoke an API Gateway endpoint (both values are passed as [runtime properties](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-properties.html)). The complete list of settings for the source (_FlinkKinesisConsumer_) can be found on [GitHub](https://github.com/apache/flink/tree/release-1.8/flink-connectors/flink-connector-kinesis/src/main/java/org/apache/flink/streaming/connectors/kinesis/config).

### 4. Build the application using Apache Maven
> **Note**: In order for your application to use the Apache Flink Kinesis connector, you must download, compile, and install Apache Flink. This connector is used to consume data from a Kinesis stream used as an application source, or to write data to a Kinesis stream used for application output. For more information, see [Using the Apache Flink Kinesis Streams Connector](https://docs.aws.amazon.com/kinesisanalytics/latest/java/how-creating-apps.html#how-creating-apps-building-kinesis).

```
mvn clean package --quiet -Dflink.version=1.8.2
```
