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

import com.demo.events.Event;
import com.demo.events.RideRequest;
import com.demo.operators.Sig4SignedHttpRequestAsyncFunction;
import com.demo.operators.Sig4SignedHttpRequestAsyncFunction.HttpRequest;
import com.demo.operators.Sig4SignedHttpRequestAsyncFunction.HttpResponse;
import com.demo.utils.ParameterToolUtils;

import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import com.google.common.collect.ImmutableMap;
import java.net.URI;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.TimeUnit;
import org.apache.flink.api.common.typeinfo.TypeHint;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.kinesis.shaded.com.amazonaws.regions.DefaultAwsRegionProviderChain;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.flink.streaming.api.TimeCharacteristic;
import org.apache.flink.streaming.api.datastream.AsyncDataStream;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.source.SourceFunction;
import org.apache.flink.streaming.connectors.kinesis.FlinkKinesisConsumer;
import org.apache.flink.streaming.connectors.kinesis.config.AWSConfigConstants;
import org.apache.flink.streaming.connectors.kinesis.config.ConsumerConfigConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.http.SdkHttpMethod;

public class StreamingJob {
    private static final Logger LOG = LoggerFactory.getLogger(StreamingJob.class);
    private static final String DEFAULT_REGION_NAME = new DefaultAwsRegionProviderChain().getRegion();

    private static SourceFunction<Event> createSource(ParameterTool parameters) {
        Properties inputProperties = new Properties();
        inputProperties.setProperty(AWSConfigConstants.AWS_REGION, parameters.get("Region", DEFAULT_REGION_NAME));
        inputProperties.setProperty(AWSConfigConstants.AWS_CREDENTIALS_PROVIDER, "AUTO");
        inputProperties.setProperty(ConsumerConfigConstants.SHARD_GETRECORDS_INTERVAL_MILLIS, "1000");
        inputProperties.setProperty(ConsumerConfigConstants.STREAM_INITIAL_POSITION, "LATEST");
        inputProperties.setProperty(ConsumerConfigConstants.SHARD_USE_ADAPTIVE_READS, "true");

        String inputStream = parameters.getRequired("InputStreamName");
        LOG.info("Using {} as source", inputStream);

        return new FlinkKinesisConsumer<>(inputStream, new Event.EventSchema(), inputProperties);
    }

    public static void main(String[] args) throws Exception {
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setStreamTimeCharacteristic(TimeCharacteristic.EventTime);

        Map<String, Properties> applicationProperties = KinesisAnalyticsRuntime.getApplicationProperties();
        Properties flinkProperties = applicationProperties.get("FlinkApplicationProperties");
        ParameterTool parameters = ParameterToolUtils.fromApplicationProperties(flinkProperties);

        // Extract some important parameters for later
        ObjectMapper mapper = new ObjectMapper();
        URI predictFareEndpoint = URI.create(parameters.getRequired("RideApiEndpoint") + "predictFare");
        Map<String,String> apiKeyHeader = ImmutableMap.of("x-api-key", parameters.getRequired("ApiKey"));

        DataStream<Event> events = env
            .addSource(createSource(parameters))
            .rebalance();

        /*
        * Filter out ride requests that are sent to us. Call an API to obtain an estimate fare for the request and
        * enrich the requests with the expected fare.
        */

        DataStream<RideRequest> rideRequests = events
            // Only keep RideRequest in this stream
            .filter(event -> RideRequest.class.isAssignableFrom(event.getClass()))
            // Cast events to proper RideRequest type
            .map(event -> (RideRequest) event);

        DataStream<HttpRequest<RideRequest>> predictFareRequests = rideRequests
            // Set request id; will be removed with the new schema
            .map(request -> request.withRideRequestId(request.tripId))
            // Deterministically filter events based on id to reduce throughput for dev environment
            .filter(request -> request.rideRequestId % 20 == 0)
            // Construct GET request to query expected trip fare
            .map(request -> new HttpRequest<>(request, SdkHttpMethod.GET).withRawQueryParameter("ride_request_id", request.rideRequestId.toString()))
            // Add type hint as the generic type parameter of HttpRequest<RideRequest> cannot be inferred automatically
            .returns(new TypeHint<HttpRequest<RideRequest>>() {});

        DataStream<HttpResponse<RideRequest>> predictFareResponse =
            // Asynchronously call predictFare Endpoint
            AsyncDataStream.unorderedWait(
                predictFareRequests,
                new Sig4SignedHttpRequestAsyncFunction<>(predictFareEndpoint, apiKeyHeader),
                30, TimeUnit.SECONDS, 20
            )
            .returns(new TypeHint<HttpResponse<RideRequest>>() {});

        DataStream<RideRequest> enrichedRideRequest = predictFareResponse
            // Only keep successful responses for enrichment, which have a 200 status code
            .filter(response -> response.statusCode == 200)
            // Enrich RideRequest with response from predictFareEndpoint
            .map(response -> {
                double expectedFare = mapper.readValue(response.responseBody, ObjectNode.class).get("expected_fare").asDouble();
                return response.triggeringEvent.withExpectedFare(expectedFare);
            });

        // Once the responses are received, you can do many other actions, such as:
        // Filter trip requests that have a high fare; save the results to S3; etc.
        enrichedRideRequest.print();

        env.execute("Flink Streaming Demo");
    }
}
