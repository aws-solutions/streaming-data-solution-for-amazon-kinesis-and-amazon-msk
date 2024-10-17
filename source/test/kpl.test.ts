/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { aws_kinesis as kinesis } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { KinesisProducer } from '../lib/kpl-producer';

let stack: cdk.Stack;
let testStream: kinesis.Stream;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    testStream = new kinesis.Stream(stack, 'TestStream');
});

test('creates a KPL instance', () => {
    const kpl = new KinesisProducer(stack, 'TestProducer', {
        stream: testStream,
        vpcId: 'vpc-123',
        subnetId: 'subnet-abc',
        imageId: 'ami-1234',
        codeBucketName: 'test-bucket',
        codeFileKey: 'test-key.zip'
    });

    expect(kpl.InstanceId).not.toBeUndefined();
});

test('adds cfn_nag suppressions', () => {
    new KinesisProducer(stack, 'TestProducer', {
        stream: testStream,
        vpcId: 'vpc-123',
        subnetId: 'subnet-abc',
        imageId: 'ami-1234',
        codeBucketName: 'test-bucket',
        codeFileKey: 'test-key.zip'
    });

    Template.fromStack(stack).hasResource('AWS::IAM::Policy', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: 'Session Manager actions do not support resource level permissions'
                }]
            }
        }
    });

    Template.fromStack(stack).hasResource('AWS::IAM::Policy', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: 'PutMetricData action does not support resource level permissions'
                }]
            }
        }
    });

    Template.fromStack(stack).hasResource('AWS::EC2::SecurityGroup', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W5',
                    reason: 'Outbound access is allowed to connect to Kinesis'
                }]
            }
        }
    });
});
