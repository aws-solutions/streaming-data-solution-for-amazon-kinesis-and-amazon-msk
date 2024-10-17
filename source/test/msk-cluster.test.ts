/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import {
    KafkaCluster,
    KafkaAccessControl,
    KafkaActiveVersion,
    KafkaInstanceType,
    KafkaMonitoringLevel
} from '../lib/msk-cluster';

const twoSubnets = ['subnet-a', 'subnet-b'];

describe('successful scenarios', () => {
    let stack: cdk.Stack;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack1');
    });

    test.each([2, 4, 6])('creates a MSK cluster', (validNodeCount) => {
        const cluster = new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: validNodeCount,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        });

        expect(cluster.ClusterArn).not.toBeUndefined();
        expect(cluster.SecurityGroupId).not.toBeUndefined();

        for (const rule of KafkaCluster.RequiredRules) {
            Template.fromStack(stack).hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
                IpProtocol: 'tcp',
                FromPort: rule.port,
                ToPort: rule.port,
                Description: rule.description
            });
        }
    });

    test('uses IAM for access control', () => {
        new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: 2,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.IAM,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        });

    });

    test('uses SCRAM for access control', () => {
        new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: 2,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.SCRAM,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        });

    });

    test('accepts CloudFormation parameters', () => {
        const numberOfBrokerNodes = new cdk.CfnParameter(stack, 'NumberOfBrokerNodes', { type: 'Number' });
        const clientSubnets = new cdk.CfnParameter(stack, 'ClientSubnets', { type: 'List<AWS::EC2::Subnet::Id>' });
        const kafkaVersion = new cdk.CfnParameter(stack, 'KafkaVersion', { allowedValues: Object.values(KafkaActiveVersion) });
        const instanceType = new cdk.CfnParameter(stack, 'InstanceType', { allowedValues: Object.values(KafkaInstanceType) });
        const monitoringLevel = new cdk.CfnParameter(stack, 'MonitoringLevel', { allowedValues: Object.values(KafkaMonitoringLevel) });
        const volumeSize = new cdk.CfnParameter(stack, 'EbsVolumeSize', { type: 'Number' });

        new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: kafkaVersion.valueAsString,
            numberOfBrokerNodes: numberOfBrokerNodes.valueAsNumber,
            brokerInstanceType: instanceType.valueAsString,
            monitoringLevel: monitoringLevel.valueAsString,
            ebsVolumeSize: volumeSize.valueAsNumber,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: clientSubnets.valueAsList
        });

        Template.fromStack(stack).hasResourceProperties('AWS::MSK::Cluster', {
            NumberOfBrokerNodes: { Ref: 'NumberOfBrokerNodes' },
            BrokerNodeGroupInfo: {
                ClientSubnets: { Ref: 'ClientSubnets' },
            }
        });
    });
});

describe('validation tests', () => {
    let stack: cdk.Stack;

    beforeEach(() => {
        const app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack2');
    });

    test.each([0, 1, 4])('subnet count must be between allowed values', (invalidSubnetCount) => {
        const subnets: string[] = [];
        for (let index = 0; index < invalidSubnetCount; index++) {
            subnets.push(`subnet-${index}`);
        }

        expect(() => new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: 2,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: subnets
        })).toThrowError(/brokerSubnets must contain between 2 and 3 items/);
    });

    test.each([0, -1])('number of broker nodes must be positive', (invalidNodeCount) => {
        expect(() => new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: invalidNodeCount,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        })).toThrowError(/numberOfBrokerNodes must be a positive number/);
    });

    test.each([1, 3, 5])('number of broker nodes must be multiple of subnet count', (invalidNodeCount) => {
        expect(() => new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: invalidNodeCount,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: 1000,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        })).toThrowError(/numberOfBrokerNodes must be a multiple of brokerSubnets/);
    });

    test.each([0, 16385])('volume size must be between allowed values', (invalidSize) => {
        expect(() => new KafkaCluster(stack, 'TestMsk', {
            kafkaVersion: KafkaActiveVersion.V3_5_1,
            numberOfBrokerNodes: 2,
            brokerInstanceType: KafkaInstanceType.m5_large,
            monitoringLevel: KafkaMonitoringLevel.DEFAULT,
            ebsVolumeSize: invalidSize,
            accessControl: KafkaAccessControl.Unauthenticated,

            brokerVpcId: 'my-vpc-id',
            brokerSubnets: twoSubnets
        })).toThrowError(`ebsVolumeSize must be a value between 1 and 16384 GiB (given ${invalidSize})`);
    });
});
