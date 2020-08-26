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

import * as cdk from '@aws-cdk/core';
import { expect as expectCDK, haveResource, ResourcePart } from '@aws-cdk/assert';

import { DataStream } from '../lib/kds-data-stream';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates a KDS data stream', () => {
    new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.days(3),
        shardCount: 2
    });

    expectCDK(stack).to(haveResource('AWS::Kinesis::Stream', {
        ShardCount: 2,
        RetentionPeriodHours: 72,
        StreamEncryption: {
            EncryptionType: 'KMS',
            KeyId: 'alias/aws/kinesis'
        }
    }));
});

test('adds cfn_nag suppressions', () => {
    new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.days(3),
        shardCount: 2
    });

    expectCDK(stack).to(haveResource('AWS::IAM::Policy', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: 'Kinesis enhanced monitoring actions do not support resource level permissions'
                }]
            }
        }
    }, ResourcePart.CompleteDefinition));
});

test.each([0, -1])('shard count must be positive', (invalidShardCount) => {
    expect(() => new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.days(1),
        shardCount: invalidShardCount
    })).toThrowError(/shardCount must be a positive number/);
});

test.each([23, 169])('retention period must be between allowed values', (invalidHours) => {
    expect(() => new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.hours(invalidHours),
        shardCount: 2
    })).toThrowError(`retentionPeriod must be between 24 and 168 hours. Received ${invalidHours}`);
});
