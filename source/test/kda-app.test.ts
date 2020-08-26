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
import * as logs from '@aws-cdk/aws-logs';
import * as kinesis from '@aws-cdk/aws-kinesis';
import * as s3 from '@aws-cdk/aws-s3';
import { expect as expectCDK, haveResource, haveResourceLike, ResourcePart, SynthUtils } from '@aws-cdk/assert';

import { FlinkApplication } from '../lib/kda-flink-application';

describe('successful scenarios', () => {
    let stack: cdk.Stack;

    beforeAll(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');

        new FlinkApplication(stack, 'TestApplication', {
            inputStream: new kinesis.Stream(stack, 'TestStream'),
            outputBucket: new s3.Bucket(stack, 'TestBucket'),

            logsRetentionDays: logs.RetentionDays.ONE_WEEK,
            logLevel: 'INFO',
            metricsLevel: 'APPLICATION',

            codeBucketArn: 'arn:aws:s3:::some-bucket',
            codeFileKey: 'some-key.zip',

            enableAutoScaling: 'true',
            enableSnapshots: 'true',

            subnetIds: ['subnet-a', 'subnet-b'],
            securityGroupIds: ['sg-123']
        });
    });

    test('creates a KDA flink application', () => {
        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    });

    test('configures logging for the KDA application', () => {
        expectCDK(stack).to(haveResource('AWS::Logs::LogGroup', {
            RetentionInDays: 7
        }));

        expectCDK(stack).to(haveResource('AWS::Logs::LogStream'));
        expectCDK(stack).to(haveResource('AWS::KinesisAnalyticsV2::ApplicationCloudWatchLoggingOption'));
    });

    test('creates an IAM role for KDA', () => {
        expectCDK(stack).to(haveResource('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [{
                    Action: 'sts:AssumeRole',
                    Effect: 'Allow',
                    Principal: {
                        Service: 'kinesisanalytics.amazonaws.com'
                    }
                }],
                Version: '2012-10-17'
            }
        }));

        expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Action: [
                            'kinesis:DescribeStreamSummary',
                            'kinesis:GetRecords',
                            'kinesis:GetShardIterator',
                            'kinesis:ListShards',
                            'kinesis:SubscribeToShard'
                        ],
                        Effect: 'Allow'
                    },
                    {
                        Action: [
                            's3:GetObject*',
                            's3:GetBucket*',
                            's3:List*',
                            's3:DeleteObject*',
                            's3:PutObject*',
                            's3:Abort*'
                        ],
                        Effect: 'Allow'
                    }
                ]
            }
        }));

        expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Action: [
                            'ec2:CreateNetworkInterface',
                            'ec2:DescribeNetworkInterfaces',
                            'ec2:DescribeVpcs',
                            'ec2:DeleteNetworkInterface',
                            'ec2:DescribeDhcpOptions',
                            'ec2:DescribeSubnets',
                            'ec2:DescribeSecurityGroups'
                        ],
                        Effect: 'Allow'
                    },
                    {
                        Action: 'ec2:CreateNetworkInterfacePermission',
                        Effect: 'Allow'
                    }
                ]
            }
        }));
    });

    test('adds cfn_nag suppressions', () => {
        expectCDK(stack).to(haveResource('AWS::IAM::Policy', {
            Metadata: {
                cfn_nag: {
                    rules_to_suppress: [{
                        id: 'W12',
                        reason: 'Actions do not support resource level permissions'
                    }]
                }
            }
        }, ResourcePart.CompleteDefinition));
    });
});

describe('validation tests', () => {
    let stack: cdk.Stack;
    let fakeStream: kinesis.IStream;
    let fakeBucket: s3.IBucket;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');
        fakeStream = new kinesis.Stream(stack, 'TestStream');
        fakeBucket = new s3.Bucket(stack, 'TestBucket');
    });

    test('invalid log level', () => {
        expect(() => new FlinkApplication(stack, 'TestApplication', {
            inputStream: fakeStream,
            outputBucket: fakeBucket,

            logsRetentionDays: logs.RetentionDays.ONE_WEEK,
            logLevel: 'FOO',
            metricsLevel: 'APPLICATION',

            codeBucketArn: 'arn:aws:s3:::some-bucket',
            codeFileKey: 'some-key.zip',

            enableAutoScaling: 'true',
            enableSnapshots: 'true'
        })).toThrowError(/Unknown log level: FOO/);
    });

    test('invalid metric level', () => {
        expect(() => new FlinkApplication(stack, 'TestApplication', {
            inputStream: fakeStream,
            outputBucket: fakeBucket,

            logsRetentionDays: logs.RetentionDays.ONE_WEEK,
            logLevel: 'INFO',
            metricsLevel: 'BAR',

            codeBucketArn: 'arn:aws:s3:::some-bucket',
            codeFileKey: 'some-key.zip',

            enableAutoScaling: 'true',
            enableSnapshots: 'true'
        })).toThrowError(/Unknown metrics level: BAR/);
    });
});
