/*********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

package com.demo;

import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import com.google.gson.*;
import com.google.gson.internal.Streams;
import com.google.gson.stream.JsonReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Properties;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.api.common.serialization.AbstractDeserializationSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.api.java.typeutils.TypeExtractor;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.connectors.kafka.FlinkKafkaConsumer;
import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.Table;

import static org.apache.flink.table.api.Expressions.$;
import static org.apache.flink.table.api.Expressions.dateFormat;

public class KafkaGettingStartedJob {
    public static void main(String[] args) throws Exception {
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        StreamTableEnvironment streamTableEnvironment = StreamTableEnvironment.create(env, EnvironmentSettings.newInstance().useBlinkPlanner().build());

        Properties flinkProperties = KinesisAnalyticsRuntime.getApplicationProperties().get("FlinkApplicationProperties");
        String topicName = flinkProperties.getProperty("TopicName");
        String bootstrapServers = flinkProperties.getProperty("BootstrapServers");
        String outputBucket = flinkProperties.getProperty("OutputBucketName");

        Properties consumerProperties = new Properties();
        consumerProperties.setProperty("bootstrap.servers", bootstrapServers);
        consumerProperties.setProperty("group.id", "FlinkConsumerGroup");

        // These properties are necessary if the MSK cluster is configured to only accept TLS traffic.
        consumerProperties.setProperty("security.protocol", "SSL");
        consumerProperties.setProperty("ssl.truststore.location", "/usr/local/openjdk-11/lib/security/cacerts");
        consumerProperties.setProperty("ssl.truststore.password", "changeit");

        FlinkKafkaConsumer<StockRecord> consumer = new FlinkKafkaConsumer<>(topicName, new KafkaEventDeserializationSchema(), consumerProperties);
        consumer.setStartFromEarliest();

        // The following lines will use the Table API to read events from a topic, but you can also use the SQL API for a similar result.
        DataStream<StockRecord> events = env.addSource(consumer);
        Table table = streamTableEnvironment.fromDataStream(events);

        // The string "event_time" is repeated, but this is just to showcase the Table API.
        @SuppressWarnings("squid:S1192")
        final Table filteredTable = table.
            select(
                $("event_time"), $("ticker"), $("price"),
                dateFormat($("event_time"), "yyyy-MM-dd").as("dt"),
                dateFormat($("event_time"), "HH").as("hr")
            ).
            where($("price").isGreater(50));

        final String s3Sink =
            "CREATE TABLE sink_table (event_time TIMESTAMP, ticker STRING, price DOUBLE, dt STRING, hr STRING) " +
            "PARTITIONED BY (ticker, dt, hr) " +
            "WITH ('connector' = 'filesystem', 'path' = 's3a://" + outputBucket + "/tableapi', 'format' = 'json')";

        streamTableEnvironment.executeSql(s3Sink);
        filteredTable.executeInsert("sink_table");

        env.execute("Application that reads from MSK and writes to S3");
    }

    public static class KafkaEventDeserializationSchema extends AbstractDeserializationSchema<StockRecord> {
        @Override
        public StockRecord deserialize(byte[] bytes) {
            try {
                return (StockRecord) Event.parseEvent(bytes);
            } catch (Exception e) {
                return null;
            }
        }

        @Override
        public boolean isEndOfStream(StockRecord event) {
            return false;
        }

        @Override
        public TypeInformation<StockRecord> getProducedType() {
            return TypeExtractor.getForClass(StockRecord.class);
        }
    }

    // Fields are private, but can be accessed due to Getter/Setter annotations.
    @SuppressWarnings("squid:S1068")
    @Getter
    @Setter
    @ToString
    public static class StockRecord extends Event {
        // Naming convention is not used to match producer format.
        @SuppressWarnings("squid:S00116")
        private Timestamp event_time;

        private String ticker;
        private Double price;
    }

    public static class Event {
        private static Gson gson = new GsonBuilder()
            .setDateFormat("yyyy-MM-dd hh:mm:ss")
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
            .registerTypeAdapter(Instant.class, (JsonDeserializer<Instant>) (json, typeOfT, context) -> Instant.parse(json.getAsString()))
            .create();

        public static Event parseEvent(byte[] event) {
            JsonReader jsonReader = new JsonReader(new InputStreamReader(new ByteArrayInputStream(event)));
            JsonElement jsonElement = Streams.parse(jsonReader);
            return gson.fromJson(jsonElement, StockRecord.class);
        }
    }
}
