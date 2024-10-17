/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


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
