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
import * as lambda from '@aws-cdk/aws-lambda';
import { expect as expectCDK, haveResource, haveResourceLike, ResourcePart, SynthUtils } from '@aws-cdk/assert';

import { KafkaConsumer } from '../lib/msk-consumer';

describe('successful scenarios', () => {
    let stack: cdk.Stack;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack1');
    });

    test('creates a MSK Lambda consumer', () => {
        new KafkaConsumer(stack, 'TestMsk', {
            clusterArn: 'my-cluster-arn',
            batchSize: 10,
            enabled: true,
            startingPosition: lambda.StartingPosition.LATEST,
            timeout: cdk.Duration.minutes(1),
            code: lambda.Code.fromInline('foo'),
            topicName: 'my-topic',
            environmentVariables: {
                'MY_ENV_VARIABLE': 'foo'
            }
        });

        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();

        expectCDK(stack).to(haveResource('AWS::IAM::Role', {
            Metadata: {
                cfn_nag: {
                    rules_to_suppress: [{
                        id: 'W11',
                        reason: 'Actions do not support resource level permissions'
                    }]
                }
            }
        }, ResourcePart.CompleteDefinition));
    });

    test('accepts CloudFormation parameters', () => {
        const clusterArn = new cdk.CfnParameter(stack, 'ClusterArn', { type: 'String' });
        const batchSize = new cdk.CfnParameter(stack, 'BatchSize', { type: 'Number' });
        const topicName = new cdk.CfnParameter(stack, 'TopicName', { type: 'String' });

        new KafkaConsumer(stack, 'TestMsk', {
            clusterArn: clusterArn.valueAsString,
            batchSize: batchSize.valueAsNumber,
            enabled: true,
            startingPosition: lambda.StartingPosition.LATEST,
            timeout: cdk.Duration.minutes(1),
            code: lambda.Code.fromInline('foo'),
            topicName: topicName.valueAsString
        });

        expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
        expectCDK(stack).to(haveResourceLike('AWS::Lambda::EventSourceMapping', {
            EventSourceArn: { Ref: 'ClusterArn' },
            BatchSize: { Ref: 'BatchSize' },
            Topics: [{ Ref: 'TopicName' }]
        }));
    });
});

describe('validation tests', () => {
    let stack: cdk.Stack;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack2');
    });

    test.each([0, 841])('timeout must be between allowed values', (invalidTimeoutSeconds) => {
        expect(() => new KafkaConsumer(stack, 'TestMsk', {
            clusterArn: 'my-cluster-arn',
            batchSize: 10,
            enabled: true,
            startingPosition: lambda.StartingPosition.LATEST,
            timeout: cdk.Duration.seconds(invalidTimeoutSeconds),
            code: lambda.Code.fromInline('foo'),
            topicName: 'my-topic'
        })).toThrowError(`timeout must be a value between 1 and 840 seconds (given ${invalidTimeoutSeconds})`);
    });

    test.each([-1, 0, 10001])('batch size must be between allowed values', (invalidBatchSize) => {
        expect(() => new KafkaConsumer(stack, 'TestMsk', {
            clusterArn: 'my-cluster-arn',
            batchSize: invalidBatchSize,
            enabled: true,
            startingPosition: lambda.StartingPosition.LATEST,
            timeout: cdk.Duration.minutes(1),
            code: lambda.Code.fromInline('foo'),
            topicName: 'my-topic'
        })).toThrowError(`batchSize must be between 1 and 10000 (given ${invalidBatchSize})`);
    });
});
