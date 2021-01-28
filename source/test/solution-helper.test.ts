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

import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { SolutionHelper } from '../lib/solution-helper';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates solution helper without any optional properties', () => {
    new SolutionHelper(stack, 'Helper', {
        solutionId: 'SO9999',
        pattern: 'test-pattern'
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('creates solution helper with optional properties', () => {
    new SolutionHelper(stack, 'Helper', {
        solutionId: 'SO9999',
        pattern: 'test-pattern',

        shardCount: 2,
        retentionHours: 24,
        enhancedMonitoring: 'false',

        bufferingSize: 5,
        bufferingInterval: 300,
        compressionFormat: 'GZIP',

        brokerInstanceType: 'kafka.m5.large',
        numberOfBrokerNodes: 2,
        monitoringLevel: 'DEFAULT'
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
