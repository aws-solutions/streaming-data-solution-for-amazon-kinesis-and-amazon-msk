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

package com.demo.utils;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import org.apache.flink.api.java.utils.ParameterTool;

public class ParameterToolUtils {
    public static ParameterTool fromApplicationProperties(Properties properties) {
        Map<String, String> map = new HashMap<>(properties.size());

        properties.forEach((k, v) -> map.put((String) k, (String) v));

        return ParameterTool.fromMap(map);
    }
}
