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
import { SynthUtils } from '@aws-cdk/assert';

import { KafkaCluster, BrokerInstanceType } from '../lib/msk-cluster';

const twoSubnets = ['subnet-a', 'subnet-b'];
let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test.each([2, 4, 6])('creates a MSK cluster', (validNodeCount) => {
    const cluster = new KafkaCluster(stack, 'TestCluster', {
        kafkaVersion: '2.2.1',
        numberOfBrokerNodes: validNodeCount,
        brokerInstanceType: BrokerInstanceType.m5_large,

        logsRetentionDays: logs.RetentionDays.ONE_WEEK,
        monitoringLevel: 'DEFAULT',

        brokerSubnets: twoSubnets
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
    expect(cluster.ClusterArn).not.toBeUndefined();
});

test.each([0, 1, 4])('subnet count must be between allowed values', (invalidSubnetCount) => {
    const subnets: string[] = [];
    for (let index = 0; index < invalidSubnetCount; index++) {
        subnets.push(`subnet-${index}`);
    }

    expect(() => new KafkaCluster(stack, 'TestCluster', {
        kafkaVersion: '2.2.1',
        numberOfBrokerNodes: 2,
        brokerInstanceType: BrokerInstanceType.m5_large,

        logsRetentionDays: logs.RetentionDays.ONE_WEEK,
        monitoringLevel: 'DEFAULT',

        brokerSubnets: subnets
    })).toThrowError(/brokerSubnets must contain between 2 and 3 items/);
});

test.each([0, -1])('number of broker nodes must be positive', (invalidNodeCount) => {
    expect(() => new KafkaCluster(stack, 'TestCluster', {
        kafkaVersion: '2.2.1',
        numberOfBrokerNodes: invalidNodeCount,
        brokerInstanceType: BrokerInstanceType.m5_large,

        logsRetentionDays: logs.RetentionDays.ONE_WEEK,
        monitoringLevel: 'DEFAULT',

        brokerSubnets: twoSubnets
    })).toThrowError(/numberOfBrokerNodes must be a positive number/);
});

test.each([1, 3, 5])('number of broker nodes must be multiple of subnet count', (invalidNodeCount) => {
    expect(() => new KafkaCluster(stack, 'TestCluster', {
        kafkaVersion: '2.2.1',
        numberOfBrokerNodes: invalidNodeCount,
        brokerInstanceType: BrokerInstanceType.m5_large,

        logsRetentionDays: logs.RetentionDays.ONE_WEEK,
        monitoringLevel: 'DEFAULT',

        brokerSubnets: twoSubnets
    })).toThrowError(/numberOfBrokerNodes must be a multiple of brokerSubnets/);
});
