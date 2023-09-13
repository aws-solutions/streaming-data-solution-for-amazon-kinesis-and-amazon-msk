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
import { Template} from 'aws-cdk-lib/assertions';

import { KafkaClient } from '../lib/msk-client';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates a Kafka client instance', () => {
    const ec2Client = new KafkaClient(stack, 'TestClient', {
        vpcId: 'vpc-123',
        subnetId: 'subnet-abc',
        imageId: 'ami-1234',
        instanceType: 't3.small',

        clusterSecurityGroupId: 'cluster-sg',
        clusterName: 'my-cluster',
        kafkaVersion: '2.6.0'
    });

    expect(ec2Client.InstanceId).not.toBeUndefined();
});

test('adds cfn_nag suppressions', () => {
    new KafkaClient(stack, 'TestClient', {
        vpcId: 'vpc-123',
        subnetId: 'subnet-abc',
        imageId: 'ami-1234',
        instanceType: 't3.small',

        clusterSecurityGroupId: 'cluster-sg',
        clusterName: 'my-cluster',
        kafkaVersion: '2.6.0'
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
                    reason: 'MSK actions do not support resource level permissions'
                }]
            }
        }
    });
});
