# Demo producer application
An Amazon Kinesis Data Streams producer is an application that puts user data records into a Kinesis data stream (also called data ingestion). This [demo](src/main/java/com/demo/SampleProducer.java) is built using the Kinesis Producer Library (KPL), which performs the following primary tasks:

- Aggregates user records to increase payload size and improve throughput
- Submits Amazon CloudWatch metrics on your behalf to provide visibility into producer performance
- Integrates seamlessly with the Kinesis Client Library (KCL) to de-aggregate batched records on the consumer

> **Note**: The KPL is different from the Kinesis Data Streams API that is available in the AWS SDKs. The Kinesis Data Streams API helps you manage many aspects of Kinesis Data Streams (including creating streams, resharding, and putting and getting records), while the KPL provides a layer of abstraction specifically for ingesting data.

> **When not to use the KPL?** The KPL can incur an additional processing delay (configurable via the _RecordMaxBufferedTime_ property). Applications that cannot tolerate this additional delay may need to use the AWS SDK directly.

## Modifying the application
To customize the sample application, follow the steps below:

### 1. Update the _generateData_ method
The sample application will generate  records in this format:
```json
{
    "event_time": "2020-08-01 12:00:00.000",
    "ticker": "AMZN",
    "price": 50
}
```

To change this behavior (for instance, adding or removing columns from the output), you should update the _generateData_ method:
```diff
String item = new JSONObject()
    .put("event_time", new Timestamp(System.currentTimeMillis()))
    .put("ticker", TICKERS[index])
    .put("price", RANDOM.nextDouble() * 100)
+   .put("previous_close", RANDOM.nextDouble() * 100)
    .toString();
```

### 2. (Optional) Update settings on the _getKinesisProducer_ method
The sample application will use these settings for the producer:
| Name                  | Value | Description                                                                                                           |
|-----------------------|-------|-----------------------------------------------------------------------------------------------------------------------|
| MaxConnections        | 1     | Maximum number of connections to open to the backend.                                                                 |
| RequestTimeout        | 60000 | The maximum total time (milliseconds) elapsed between when we begin a HTTP request and receiving all of the response. |
| RecordMaxBufferedTime | 2000  | Maximum amount of time (milliseconds) a record may spend being buffered before it gets sent.                          |
| AggregationEnabled    | false | Each user record is sent in its own KinesisRecord.                                                                    |

For more information about configuration parameter usage rules and value limits, see the [sample configuration properties file on GitHub](https://github.com/awslabs/amazon-kinesis-producer/blob/master/java/amazon-kinesis-producer-sample/default_config.properties).

### 3. Build the application using Apache Maven
```
mvn clean package
```

### 4. Run the application
```
java -jar target/aws-kpl-demo.jar <stream-name> <aws-region> <seconds-to-run>
```