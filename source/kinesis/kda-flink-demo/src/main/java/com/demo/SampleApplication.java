/*********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

import com.amazonaws.regions.Regions;
import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import com.demo.utils.ParameterToolUtils;

import java.io.IOException;
import java.util.Map;
import java.util.Properties;

import org.apache.flink.api.common.serialization.SimpleStringEncoder;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.api.common.typeinfo.Types;
import org.apache.flink.api.java.tuple.Tuple2;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.core.fs.Path;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.JsonNode;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.sink.filesystem.StreamingFileSink;
import org.apache.flink.streaming.api.functions.sink.filesystem.rollingpolicies.DefaultRollingPolicy;
import org.apache.flink.streaming.api.functions.sink.filesystem.bucketassigners.DateTimeBucketAssigner;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.connectors.kinesis.config.AWSConfigConstants;
import org.apache.flink.streaming.connectors.kinesis.config.ConsumerConfigConstants;
import org.apache.flink.streaming.connectors.kinesis.FlinkKinesisConsumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SampleApplication {
    private static final Logger LOG = LoggerFactory.getLogger(SampleApplication.class);
    private static final String DEFAULT_REGION_NAME = Regions.getCurrentRegion().getName();

    private static DataStream<String> createSource(StreamExecutionEnvironment env, ParameterTool parameter) {
        Properties inputProperties = new Properties();
        inputProperties.setProperty(AWSConfigConstants.AWS_REGION, parameter.get("Region", DEFAULT_REGION_NAME));
        inputProperties.setProperty(AWSConfigConstants.AWS_CREDENTIALS_PROVIDER, "AUTO");
        inputProperties.setProperty(ConsumerConfigConstants.SHARD_GETRECORDS_INTERVAL_MILLIS, "1000");
        inputProperties.setProperty(ConsumerConfigConstants.STREAM_INITIAL_POSITION, "LATEST");
        inputProperties.setProperty(ConsumerConfigConstants.SHARD_USE_ADAPTIVE_READS, "true");

        String inputStream = parameter.getRequired("InputStreamName");
        LOG.info("Using {} as source", inputStream);

        return env.addSource(
            new FlinkKinesisConsumer<>(
                inputStream,
                new SimpleStringSchema(),
                inputProperties
            )
        );
    }

    private static StreamingFileSink<String> createDestination(ParameterTool parameter) {
        String s3SinkPath = "s3a://" + parameter.getRequired("OutputBucketName") + "/";
        LOG.info("Using {} as destination", s3SinkPath);

        return StreamingFileSink
            .forRowFormat(new Path(s3SinkPath), new SimpleStringEncoder<String>("UTF-8"))
            .withBucketAssigner(new DateTimeBucketAssigner("yyyy-MM-dd--HH"))
            .withRollingPolicy(DefaultRollingPolicy.create().build())
            .build();
    }

    public static void main(String[] args) throws Exception {
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        Map<String, Properties> applicationProperties = KinesisAnalyticsRuntime.getApplicationProperties();

        Properties flinkProperties = applicationProperties.get("FlinkApplicationProperties");
        ParameterTool parameter = ParameterToolUtils.fromApplicationProperties(flinkProperties);

        DataStream<String> input = createSource(env, parameter);
        StreamingFileSink<String> output = createDestination(parameter);

        ObjectMapper jsonParser = new ObjectMapper();
        input
            .map(value -> {
                JsonNode jsonNode = jsonParser.readValue(value, JsonNode.class);
                return new Tuple2<>(jsonNode.get("TICKER").asText(), jsonNode.get("PRICE").asDouble());
            })
            .returns(Types.TUPLE(Types.STRING, Types.DOUBLE))
            .keyBy(0)
            .timeWindow(Time.seconds(10), Time.seconds(5))
            .max(1)
            .map(value -> value.f0 + ":  max - " + value.f1.toString())
            .addSink(output);

        env.execute("Flink Streaming Demo");
    }
}
