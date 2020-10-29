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

package com.demo.operators;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Collections;
import java.util.Map;
import java.util.function.Function;
import org.apache.commons.io.Charsets;
import org.apache.commons.io.IOUtils;
import org.apache.flink.configuration.Configuration;
import org.apache.flink.streaming.api.functions.async.ResultFuture;
import org.apache.flink.streaming.api.functions.async.RichAsyncFunction;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.core.http.Crc32Validation;
import software.amazon.awssdk.core.interceptor.ExecutionAttributes;
import software.amazon.awssdk.core.internal.http.async.AsyncResponseHandler;
import software.amazon.awssdk.core.internal.http.async.SimpleHttpContentPublisher;
import software.amazon.awssdk.http.ContentStreamProvider;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpFullResponse;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.http.async.AsyncExecuteRequest;
import software.amazon.awssdk.http.async.SdkAsyncHttpClient;
import software.amazon.awssdk.http.nio.netty.NettyNioAsyncHttpClient;
import software.amazon.awssdk.regions.Region;

/**
 * AsyncFunction that makes signed HTTP requests against an AWS endpoint.
 *
 * The AsyncFunction can be used to either just call an API, eg, with a POST request. The response from the request
 * is propagated back together with the event that triggered the HTTP request. This can be used to enrich the event
 * that triggered the HTTP request.
 *
 * <code>
 *   DataStream<HttpRequest<RideRequest>> requests = ...
 *     .map(request -> new HttpRequest<>(request, SdkHttpMethod.GET)
 *       .withRawQueryParameter(..., ...)
 *       .withBody(...)
 *     )
 *     .returns(new TypeHint<HttpRequest<...>>() {});
 *
 *   DataStream<...> responses =
 *     AsyncDataStream.unorderedWait(requests, new Sig4SignedHttpRequestAsyncFunction<>(...), 30, TimeUnit.SECONDS, 20);
 *
 *   DataStream<...> enriched = responses
 * 	   .map(response -> {
 * 	        T triggeringEvent = response.triggeringEvent;
 * 	        int statusCode = response.statusCode;
 * 	        String responseBody = response.responseBody;
 *
 * 	        return ...
 *     })
 * </code>
 *
 * @param <T> the type of the event that is triggering the HTTP request to the endpoint
 */
public class Sig4SignedHttpRequestAsyncFunction<T> extends RichAsyncFunction<Sig4SignedHttpRequestAsyncFunction.HttpRequest<T>, Sig4SignedHttpRequestAsyncFunction.HttpResponse<T>> {

    private final URI uri;
    private final Map<String,String> requestHeaders;

    private transient SdkAsyncHttpClient asyncHttpClient;
    private transient Function<SdkHttpFullRequest, SdkHttpFullRequest> signer;

    public Sig4SignedHttpRequestAsyncFunction(URI uri) {
        this.uri = uri;
        this.requestHeaders = Collections.emptyMap();
    }

    public Sig4SignedHttpRequestAsyncFunction(URI uri, Map<String,String> requestHeaders) {
        this.uri = uri;
        this.requestHeaders = requestHeaders;
    }

    @Override
    public void open(Configuration parameters) throws Exception {
        asyncHttpClient = NettyNioAsyncHttpClient.builder().build();

        String[] hosts = uri.getHost().split("\\.");

        Region signingRegion = Region.of(hosts[hosts.length-3]);
        String signingName = hosts[hosts.length-4];

        Aws4Signer signer = Aws4Signer.create();

        Aws4SignerParams signerParams = Aws4SignerParams.builder()
            .signingRegion(signingRegion)
            .signingName(signingName)
            .awsCredentials(DefaultCredentialsProvider.create().resolveCredentials())
            .build();

        this.signer = request -> signer.sign(request, signerParams);
    }

    @Override
    public void close() throws Exception {
        asyncHttpClient.close();
    }

    @Override
    public void asyncInvoke(HttpRequest<T> request, ResultFuture<HttpResponse<T>> resultFuture) throws Exception {
        SdkHttpFullRequest.Builder builder = request
            .builder()
            .uri(uri);

        requestHeaders.forEach(builder::putHeader);
        SdkHttpFullRequest signedRequest = signer.apply(builder.build());

        AsyncResponseHandler<SdkHttpFullResponse> responseHandler = new AsyncResponseHandler<>(
            (sdkHttpFullResponse, executionAttributes) -> sdkHttpFullResponse,
            sdkHttpFullResponse -> Crc32Validation.validate(false, sdkHttpFullResponse),
            new ExecutionAttributes()
        );

        responseHandler
            .prepare()
            .thenAccept(response -> {
                try {
                    String responseBody;

                    if (response.content().isPresent()) {
                        responseBody = IOUtils.toString(response.content().get());
                    } else {
                        responseBody = "";
                    }

                    resultFuture.complete(Collections.singleton(
                        new HttpResponse<>(request.triggeringEvent, response.statusCode(), responseBody)
                    ));
                } catch (IOException e) {
                    resultFuture.completeExceptionally(e);
                }
            })
            .exceptionally(throwable -> {
                resultFuture.completeExceptionally(throwable);
                return null;
            });

        AsyncExecuteRequest asyncExecuteRequest = AsyncExecuteRequest
            .builder()
            .request(signedRequest)
            .requestContentPublisher(new SimpleHttpContentPublisher(signedRequest))
            .responseHandler(responseHandler)
            .build();

        asyncHttpClient.execute(asyncExecuteRequest);
    }

    /**
    * Helper object to execute a signed HTTP request. The object will encapsulate the actual event that is triggering the
    * request. The encapsulated event will be returned by the corresponding HttpResponse, so that it can be correlated
    * with the response of the HTTP request.
    *
    * @param <T> the type of the encapsulated event
    */
    public static class HttpRequest<T> {
        public final T triggeringEvent;
        private final SdkHttpFullRequest.Builder builder;

        public HttpRequest(T triggeringEvent, SdkHttpMethod method) {
            this.triggeringEvent = triggeringEvent;
            this.builder = SdkHttpFullRequest.builder().method(method);
        }

        private HttpRequest(T triggeringEvent, SdkHttpFullRequest.Builder builder) {
            this.triggeringEvent = triggeringEvent;
            this.builder = builder;
        }

        public HttpRequest<T> withRawQueryParameter(String paramName, String paramValue) {
            return new HttpRequest<T>(triggeringEvent, builder.putRawQueryParameter(paramName, paramValue));
        }

        public HttpRequest<T> withBody(String body) {
            byte[] bytes = body.getBytes(Charsets.UTF_8);

            SdkHttpFullRequest.Builder builder = this.builder
                .contentStreamProvider(new ContentStreamProvider() {
                    @Override
                    public InputStream newStream() {
                        return new ByteArrayInputStream(bytes);
                    }
                })
                .putHeader("Content-Length", Integer.toString(bytes.length));

            return new HttpRequest<T>(triggeringEvent, builder);
        }

        public SdkHttpFullRequest.Builder builder() {
            return this.builder;
        }

        @Override
        public String toString() {
            return "HttpRequest{" +
                "event=" + triggeringEvent +
                ", builder=" + builder +
                '}';
        }
    }

    /**
    * Helper object to propagate the response of an HTTP call back to the caller. The object encapsulates the
    * actual event that has been triggering the request, so that it can be correlated with the response of
    * the HTTP request.
    *
    * @param <T> the type of the encapsulated event
    */
    public static class HttpResponse<T> {
        public final T triggeringEvent;
        public final int statusCode;
        public final String responseBody;

        public HttpResponse(T triggeringEvent, int statusCode, String responseBody) {
            this.triggeringEvent = triggeringEvent;
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        @Override
        public String toString() {
            return "Response{" +
                "requestPayload=" + triggeringEvent +
                ", statusCode=" + statusCode +
                ", body='" + responseBody + '\'' +
                '}';
        }
    }
}