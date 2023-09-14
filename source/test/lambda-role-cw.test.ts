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

import * as cdk  from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';

import { ExecutionRole } from '../lib/lambda-role-cloudwatch';

let stack: cdk.Stack;

const expectedAssumeRolePolicy = {
    Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: {
            Service: 'lambda.amazonaws.com'
        }
    }],
    Version: '2012-10-17'
};

const expectedLogPolicy = {
    PolicyDocument: {
        Statement: [{
            Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            Effect: 'Allow',
            Resource: {
                'Fn::Join': [
                    '',
                    [
                        'arn:',
                        { 'Ref': 'AWS::Partition' },
                        ':logs:',
                        { 'Ref': 'AWS::Region' },
                        ':',
                        { 'Ref': 'AWS::AccountId' },
                        ':log-group:/aws/lambda/*'
                    ]
                ]
            }
        }],
        Version: '2012-10-17'
    },
    PolicyName: 'CloudWatchLogsPolicy'
};

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates a CloudWatch role for Lambda functions without extra policies', () => {
    new ExecutionRole(stack, 'TestRole');

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: expectedAssumeRolePolicy,
        Policies: [expectedLogPolicy]
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', Match.not({
        ManagedPolicyArns: []
    }));
});

test('creates a CloudWatch role for Lambda functions with extra policies', () => {
    new ExecutionRole(stack, 'TestRole', {
        inlinePolicyName: 'extra-policy',
        inlinePolicyDocument: new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
                resources: ['arn:aws:kinesisanalytics:1234:5678:application/my-app'],
                actions: ['kinesisanalytics:DescribeApplication']
            })]
        })
    });

    const expectedExtraPolicy = {
        PolicyDocument: {
            Statement: [{
                Action: 'kinesisanalytics:DescribeApplication',
                Effect: 'Allow',
                Resource: 'arn:aws:kinesisanalytics:1234:5678:application/my-app'
            }],
            Version: '2012-10-17'
        },
        PolicyName: 'extra-policy'
    };

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: expectedAssumeRolePolicy,
        Policies: [expectedLogPolicy, expectedExtraPolicy]
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', Match.not({
        ManagedPolicyArns: []
    }));
});
