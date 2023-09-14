/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
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

import * as cdk  from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { FlinkApplication } from '../lib/kda-flink-application';
import { FlinkLogLevels, FlinkMetricLevels } from '../lib/kda-base';

let stack: cdk.Stack;

beforeAll(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    new FlinkApplication(stack, 'TestApplication', {
        environmentProperties: {
            propertyGroupId: 'some-group-id',
            propertyMap: {
                'some-property': 'foo'
            }
        },
        logsRetentionDays: logs.RetentionDays.ONE_WEEK,
        logLevel: FlinkLogLevels.INFO,
        metricsLevel: FlinkMetricLevels.APPLICATION,

        codeBucketArn: 'arn:aws:s3:::some-bucket',
        codeFileKey: 'some-key.zip',

        enableAutoScaling: 'true',
        enableSnapshots: 'true',

        subnetIds: ['subnet-a', 'subnet-b'],
        securityGroupIds: ['sg-123']
    });
});

test('configures logging for the KDA application', () => {
    Template.fromStack(stack).hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7
    });

    expect(Object.keys(Template.fromStack(stack).findResources('AWS::Logs::LogStream')).length).toBeGreaterThan(0);
    expect(Object.keys(Template.fromStack(stack).findResources('AWS::KinesisAnalyticsV2::ApplicationCloudWatchLoggingOption')).length).toBeGreaterThan(0);
});

test('creates an IAM role for KDA', () => {
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
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
    });
});

test('adds cfn_nag suppressions', () => {
    Template.fromStack(stack).hasResource('AWS::IAM::Role', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'EC2 actions in VPC policy do not support resource level permissions'
                }]
            }
        }
    });
});
