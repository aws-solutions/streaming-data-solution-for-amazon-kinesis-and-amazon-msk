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

package com.demo.events;

import com.google.gson.*;
import com.google.gson.internal.Streams;
import com.google.gson.stream.JsonReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.Instant;
import org.apache.commons.io.Charsets;
import org.apache.flink.api.common.serialization.AbstractDeserializationSchema;
import org.apache.flink.api.common.serialization.SerializationSchema;

public class Event {
    private static final Gson gson = new GsonBuilder()
        .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
        .registerTypeAdapter(Instant.class, (JsonDeserializer<Instant>) (json, typeOfT, context) -> Instant.parse(json.getAsString()))
        .create();

    public String toString() {
        return gson.toJson(this);
    }

    public static class EventSchema extends AbstractDeserializationSchema<Event> implements SerializationSchema<Event> {
        @Override
        public Event deserialize(byte[] bytes) throws IOException {
            JsonReader jsonReader =  new JsonReader(new InputStreamReader(new ByteArrayInputStream(bytes)));
            JsonElement jsonElement = Streams.parse(jsonReader);

            return gson.fromJson(jsonElement, RideRequest.class);
        }

        @Override
        public byte[] serialize(Event event) {
            return this.toString().getBytes(Charsets.UTF_8);
        }
    }
}
