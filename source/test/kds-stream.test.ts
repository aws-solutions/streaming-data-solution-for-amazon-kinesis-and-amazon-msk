/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Template} from 'aws-cdk-lib/assertions';

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

    Template.fromStack(stack).hasResourceProperties('AWS::Kinesis::Stream', {
        ShardCount: 2,
        RetentionPeriodHours: 72,
        StreamEncryption: {
            EncryptionType: 'KMS',
            KeyId: 'alias/aws/kinesis'
        }
    });
});

test('adds cfn_nag suppressions', () => {
    new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.days(3),
        shardCount: 2
    });

    Template.fromStack(stack).hasResource('AWS::IAM::Role', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'Kinesis enhanced monitoring actions do not support resource level permissions'
                }]
            }
        }
    });
});

test.each([0, -1])('shard count must be positive', (invalidShardCount) => {
    expect(() => new DataStream(stack, 'TestDataStream', {
        enableEnhancedMonitoring: 'true',
        retentionPeriod: cdk.Duration.days(1),
        shardCount: invalidShardCount
    })).toThrowError(/shardCount must be a positive number/);
});
