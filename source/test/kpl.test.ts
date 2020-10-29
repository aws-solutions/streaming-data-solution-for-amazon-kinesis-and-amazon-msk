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
import * as kinesis from '@aws-cdk/aws-kinesis';
import { SynthUtils, expect as expectCDK, haveResource, ResourcePart } from '@aws-cdk/assert';

import { KinesisProducer } from '../lib/kpl-producer';

let stack: cdk.Stack;
let testStream: kinesis.Stream;
let testVpcId: string;
let testSubnetId: string;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    testStream = new kinesis.Stream(stack, 'TestStream');
    testVpcId = 'vpc-123';
    testSubnetId = 'subnet-abc';
});

test('creates a KPL instance', () => {
    const kpl = new KinesisProducer(stack, 'TestProducer', {
        stream: testStream,
        vpcId: testVpcId,
        subnetId: testSubnetId,
        imageId: 'ami-1234',
        codeBucketName: 'test-bucket',
        codeFileKey: 'test-key.zip'
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    expect(kpl.InstanceId).not.toBeUndefined();
});

test('adds cfn_nag suppressions', () => {
    new KinesisProducer(stack, 'TestProducer', {
        stream: testStream,
        vpcId: testVpcId,
        subnetId: testSubnetId,
        imageId: 'ami-1234',
        codeBucketName: 'test-bucket',
        codeFileKey: 'test-key.zip'
    });

    expectCDK(stack).to(haveResource('AWS::IAM::Policy', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: 'Session Manager actions do not support resource level permissions'
                }]
            }
        }
    }, ResourcePart.CompleteDefinition));

    expectCDK(stack).to(haveResource('AWS::IAM::Policy', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W12',
                    reason: 'PutMetricData action does not support resource level permissions'
                }]
            }
        }
    }, ResourcePart.CompleteDefinition));

    expectCDK(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W5',
                    reason: 'Outbound access is allowed to connect to Kinesis'
                }]
            }
        }
    }, ResourcePart.CompleteDefinition));
});
