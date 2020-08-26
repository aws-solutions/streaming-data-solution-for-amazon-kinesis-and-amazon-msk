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

import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.services.kinesis.producer.Attempt;
import com.amazonaws.services.kinesis.producer.KinesisProducer;
import com.amazonaws.services.kinesis.producer.KinesisProducerConfiguration;
import com.amazonaws.services.kinesis.producer.UserRecordFailedException;
import com.amazonaws.services.kinesis.producer.UserRecordResult;
import com.google.common.collect.Iterables;
import com.google.common.util.concurrent.FutureCallback;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.UnsupportedEncodingException;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.sql.Timestamp;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.time.Instant;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SampleProducer {
    private static final Logger LOG = LoggerFactory.getLogger(SampleProducer.class);

    private static final String DEFAULT_REGION_NAME = "us-east-1";
    private static final String STREAM_NAME = "default-data-stream";

    private static final Random RANDOM = new Random();
    private static final String TIMESTAMP = Long.toString(System.currentTimeMillis());
    private static final int RECORDS_PER_SECOND = 100;
    private static final int SECONDS_TO_RUN_DEFAULT = 5;
    private static final ScheduledExecutorService EXECUTOR = Executors.newScheduledThreadPool(1);

    private static final String[] TICKERS = { "AAPL", "AMZN", "MSFT", "INTC", "TBV" };

    private static KinesisProducer getKinesisProducer(final String region) {
        KinesisProducerConfiguration config = new KinesisProducerConfiguration();
        config.setRegion(region);
        config.setCredentialsProvider(new DefaultAWSCredentialsProviderChain());
        config.setMaxConnections(1);
        config.setRequestTimeout(60000);
        config.setRecordMaxBufferedTime(2000);
        config.setAggregationEnabled(false);

        return new KinesisProducer(config);
    }

    private static String getArgIfPresent(final String[] args, final int index, final String defaultValue) {
        return args.length > index ? args[index] : defaultValue;
    }

    /** @param args The command line args for the Sample Producer. It takes 3 optional position parameters:
     *  1. The stream name to use (default-data-stream is default)
     *  2. The region name to use (us-east-1 is default)
     *  3. The duration of the test in seconds, 5 is the default.
     *
     * Sample usage:
     * java -jar aws-kpl-demo-1.0.0.jar my-stream us-east-1 10
     */
    public static void main(String[] args) throws Exception {
        final String streamName = getArgIfPresent(args, 0, STREAM_NAME);
        final String region = getArgIfPresent(args, 1, DEFAULT_REGION_NAME);
        final String secondsToRunString = getArgIfPresent(args, 2, String.valueOf(SECONDS_TO_RUN_DEFAULT));
        final int secondsToRun = Integer.parseInt(secondsToRunString);
        if (secondsToRun <= 0) {
            LOG.error("Seconds to Run should be a positive integer");
            System.exit(1);
        }

        final KinesisProducer producer = getKinesisProducer(region);
        final AtomicLong sequenceNumber = new AtomicLong(0);
        final AtomicLong completed = new AtomicLong(0);

        LOG.info(String.format("Stream name: %s; Region: %s", streamName, region));

        FutureCallback<UserRecordResult> callback = new FutureCallback<UserRecordResult>() {
            @Override public void onFailure(Throwable t) {
                // If we see any failures, we will log them.
                if (t instanceof UserRecordFailedException) {
                    Attempt last = Iterables.getLast(((UserRecordFailedException) t).getResult().getAttempts());
                    LOG.error(String.format("Record failed to put - %s : %s", last.getErrorCode(), last.getErrorMessage()));
                }
                LOG.error("Exception during put", t);
            };

            @Override public void onSuccess(UserRecordResult result) {
                completed.getAndIncrement();
            };
        };

        final ExecutorService callbackThreadPool = Executors.newCachedThreadPool();

        // The lines within run() are the essence of the KPL API.
        final Runnable putOneRecord = new Runnable() {
            @Override
            public void run() {
                ByteBuffer data = generateData();
                // TIMESTAMP is our partition key
                ListenableFuture<UserRecordResult> f = producer.addUserRecord(streamName, TIMESTAMP, randomExplicitHashKey(), data);
                Futures.addCallback(f, callback, callbackThreadPool);
            }
        };

        EXECUTOR.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                long put = sequenceNumber.get();
                long total = RECORDS_PER_SECOND * secondsToRun;
                double putPercent = 100.0 * put / total;
                long done = completed.get();
                double donePercent = 100.0 * done / total;
                LOG.info(String.format(
                        "Put %d of %d so far (%.2f %%), %d have completed (%.2f %%)",
                        put, total, putPercent, done, donePercent));
            }
        }, 1, 1, TimeUnit.SECONDS);

        LOG.info(String.format(
            "Starting puts... will run for %d seconds at %d records per second",
            secondsToRun,
            RECORDS_PER_SECOND
        ));
        executeAtTargetRate(EXECUTOR, putOneRecord, sequenceNumber, secondsToRun, RECORDS_PER_SECOND);

        EXECUTOR.awaitTermination(secondsToRun + 1, TimeUnit.SECONDS);

        LOG.info("Waiting for remaining puts to finish...");
        producer.flushSync();
        LOG.info("All records complete.");

        producer.destroy();
        LOG.info("Finished.");
    }

    private static String randomExplicitHashKey() {
        return new BigInteger(128, RANDOM).toString(10);
    }

    private static void executeAtTargetRate(
            final ScheduledExecutorService exec,
            final Runnable task,
            final AtomicLong counter,
            final int durationSeconds,
            final int ratePerSecond) {
        exec.scheduleWithFixedDelay(new Runnable() {
            final long startTime = System.nanoTime();

            @Override
            public void run() {
                double secondsRun = (System.nanoTime() - startTime) / 1e9;
                double targetCount = Math.min(durationSeconds, secondsRun) * ratePerSecond;

                while (counter.get() < targetCount) {
                    counter.getAndIncrement();
                    try {
                        task.run();
                    } catch (Exception e) {
                        LOG.error("Error running task", e);
                        System.exit(1);
                    }
                }

                if (secondsRun >= durationSeconds) {
                    exec.shutdown();
                }
            }
        }, 0, 1, TimeUnit.MILLISECONDS);
    }

    public static ByteBuffer generateData() {
        int index = RANDOM.nextInt(TICKERS.length);

        String record = new JSONObject()
            .put("EVENT_TIME", Instant.now().toString())
            .put("TICKER", TICKERS[index])
            .put("PRICE", RANDOM.nextDouble() * 100)
            .toString();

        LOG.debug(record);

        byte[] sendData = null;
        try {
            sendData = record.getBytes("UTF-8");
        } catch (UnsupportedEncodingException e) {
            LOG.error("Error converting string to byte array " + e);
        }

        return ByteBuffer.wrap(sendData);
    }
}