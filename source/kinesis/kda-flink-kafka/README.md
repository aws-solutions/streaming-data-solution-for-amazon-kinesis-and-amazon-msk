# Demo consumer application (for Apache Kafka)
A consumer is an application that processes all data from an Apache Kafka topic. This [demo](src/main/java/com/demo/KafkaGettingStartedJob.java) is built using [Apache Flink](https://flink.apache.org/) (a popular framework and engine for processing data streams) and can be deployed as an application in Amazon Kinesis Data Analytics.

> Kinesis Data Analytics provides the underlying infrastructure for your Apache Flink applications. It handles core capabilities like provisioning compute resources, parallel computation, automatic scaling, and application backups (implemented as checkpoints and snapshots). You can use the high-level Flink programming features (such as operators, sources, and sinks) in the same way that you use them when hosting the Flink infrastructure yourself.

## Programming your Apache Flink application
Applications primarily use either the [DataStream API](https://ci.apache.org/projects/flink/flink-docs-release-1.11/dev/datastream_api.html) or the [Table API](https://ci.apache.org/projects/flink/flink-docs-release-1.11/dev/table/). Other Apache Flink APIs are also available, but they are less commonly used in building streaming applications.

> This demo uses the Table API, but the solution has a similar [example](/source/kinesis/kda-flink-demo) using the DataStream API.

### Apache Flink Table API
The Apache Flink Table API programming model is based on the following components:
- **Table Environment**: An interface to underlying data that you use to create and host one or more tables.
```java
final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
StreamTableEnvironment streamTableEnvironment = StreamTableEnvironment.create(env, EnvironmentSettings.newInstance().useBlinkPlanner().build());
```

- **Table**: An object providing access to a SQL table or view.
- **Table Source**: Used to read data from an external source, such as an Amazon MSK topic.
```java
FlinkKafkaConsumer<StockRecord> consumer = new FlinkKafkaConsumer<>("mytopicname", new KafkaEventDeserializationSchema(), consumerProperties);
consumer.setStartFromEarliest();

DataStream<StockRecord> events = env.addSource(consumer);
Table table = streamTableEnvironment.fromDataStream(events);
```

- **Table Function**: A SQL query or API call used to transform data.
```java
final Table filteredTable = table.
    select(
        $("event_time"), $("ticker"), $("price"),
        dateFormat($("event_time"), "yyyy-MM-dd").as("dt"),
        dateFormat($("event_time"), "HH").as("hr")
    ).
    where($("price").isGreater(50));
```

- **Table Sink**: Used to write data to an external location, such as an Amazon S3 bucket.
```java
final String s3Sink =
    "CREATE TABLE sink_table (event_time TIMESTAMP, ticker STRING, price DOUBLE, dt STRING, hr STRING) " +
    "PARTITIONED BY (ticker, dt, hr) " +
    "WITH ('connector' = 'filesystem', 'path' = 's3a://my-output-bucket/tableapi', 'format' = 'json')";

streamTableEnvironment.executeSql(s3Sink);
filteredTable.executeInsert("sink_table");
```

## Running the data producer
To generate the data expected by the demo application, run the following Python script from a client that can connect to the Amazon MSK cluster containing the source topic. The Python client for the Apache Kafka is used, and it must be installed as well (`pip3 install kafka-python`).

> Make sure to replace the `<BOOTSTRAP_SERVERS_LIST>` and `<TOPIC_NAME>` placeholders before running the script.

```python
from kafka import KafkaProducer
import json, time, random
from datetime import datetime

BOOTSTRAP_SERVERS = '<BOOTSTRAP_SERVERS_LIST>'
producer = KafkaProducer(
    bootstrap_servers=BOOTSTRAP_SERVERS,
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    key_serializer=str.encode,
    retry_backoff_ms=500,
    request_timeout_ms=20000,
    security_protocol='SSL')

def get_stock():
    data = {}
    data['event_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    data['ticker'] = random.choice(['AAPL', 'AMZN', 'MSFT', 'INTC', 'TBV'])
    data['price'] = round(random.random() * 100, 2)
    return data

while True:
    data = get_stock()
    print(data)
    try:
        future = producer.send('<TOPIC_NAME>', value=data, key=data['ticker'])
        producer.flush()

        record_metadata = future.get(timeout=10)
        print('sent event to Kafka! topic {} partition {} offset {}\n'.format(record_metadata.topic, record_metadata.partition, record_metadata.offset))
    except Exception as e:
        print(e.with_traceback())
    time.sleep(0.25)
```

## Modifying the application
To customize the demo application, follow the steps below:

> For more examples of creating and working with applications in Amazon Kinesis Data Analytics, see the [Apache Flink Code Examples](https://github.com/apache/flink/tree/master/flink-examples/flink-examples-streaming/src/main/java/org/apache/flink/streaming/examples) and [Amazon Kinesis Data Analytics Java Examples](https://github.com/aws-samples/amazon-kinesis-data-analytics-java-examples) respositories on GitHub.

### 1. Create classes that represent incoming data
The `KafkaGettingStartedJob` file includes two classes that represent the data created by the producer described above (`Event` and `StockRecord`) and one that showcases how a serialization schema is defined (`KafkaEventDeserializationSchema`). You can use them as a reference for your use case.

### 2. Modify the table functions
By default, the application will filter any items whose price is greater than 50, so you should change it for your use case. Even though the example uses Java methods (`select`, `dateFormat`, `where`, `isGreater`), you can also use leverage SQL commands directly:
```java
final String insertSql = "INSERT INTO sink_table SELECT event_time, ticker, price, DATE_FORMAT(event_time, 'yyyy-MM-dd') as dt, DATE_FORMAT(event_time, 'HH') as hh FROM StockRecord WHERE price > 50";
streamTableEnvironment.executeSql(insertSql);
```

### 3. (Optional) Use a different table sink
By default, the application will write data to an Amazon S3 bucket. You can also use any of the other [formats supported by Apache Flink](https://ci.apache.org/projects/flink/flink-docs-release-1.11/dev/table/connectors/#supported-connectors).

### 4. Build the application using Apache Maven
```
mvn clean package --quiet -Dflink.version=1.11.1
```
