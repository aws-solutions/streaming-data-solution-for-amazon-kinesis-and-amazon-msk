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

import * as cdk from '@aws-cdk/core';

import { SolutionHelper } from '../lib/solution-helper';
import { SolutionStackProps } from '../bin/solution-props';
import { KafkaCluster, KafkaAccessControl } from '../lib/msk-cluster';
import { KafkaClient } from '../lib/msk-client';
import { KafkaMonitoring } from '../lib/msk-monitoring';

export class MskStandalone extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
        super(scope, id, props);

        //---------------------------------------------------------------------
        // Broker configuration
        const kafkaVersion = new cdk.CfnParameter(this, 'KafkaVersion', {
            type: 'String',
            default: '2.8.0',
            allowedValues: KafkaCluster.AllowedKafkaVersions
        });

        const brokerNodes = new cdk.CfnParameter(this, 'NumberBrokerNodes', {
            type: 'Number',
            default: 3,
            minValue: 2
        });

        const brokerInstanceType = new cdk.CfnParameter(this, 'BrokerInstanceType', {
            type: 'String',
            default: 'kafka.m5.large',
            allowedValues: KafkaCluster.AllowedInstanceTypes
        });

        const monitoringLevel = new cdk.CfnParameter(this, 'MonitoringLevel', {
            type: 'String',
            default: 'DEFAULT',
            allowedValues: KafkaCluster.AllowedMonitoringLevels
        });

        const ebsVolumeSize = new cdk.CfnParameter(this, 'EbsVolumeSize', {
            type: 'Number',
            default: 1000,
            minValue: KafkaCluster.MinStorageSizeGiB,
            maxValue: KafkaCluster.MaxStorageSizeGiB
        });

        const accessControl = new cdk.CfnParameter(this, 'AccessControlMethod', {
            type: 'String',
            default: KafkaAccessControl.IAM,
            allowedValues: Object.values(KafkaAccessControl)
        });

        //---------------------------------------------------------------------
        // Networking configuration
        const brokerVpc = new cdk.CfnParameter(this, 'BrokerVpcId', {
            type: 'AWS::EC2::VPC::Id'
        });

        const brokerSubnets = new cdk.CfnParameter(this, 'BrokerSubnetIds', {
            type: 'List<AWS::EC2::Subnet::Id>'
        });

        const cluster = new KafkaCluster(this, 'Msk', {
            kafkaVersion: kafkaVersion.valueAsString,
            numberOfBrokerNodes: brokerNodes.valueAsNumber,
            brokerInstanceType: brokerInstanceType.valueAsString,
            monitoringLevel: monitoringLevel.valueAsString,
            ebsVolumeSize: ebsVolumeSize.valueAsNumber,
            accessControl: accessControl.valueAsString,

            brokerVpcId: brokerVpc.valueAsString,
            brokerSubnets: brokerSubnets.valueAsList
        });

        //---------------------------------------------------------------------
        // Client configuration
        const clientInstanceType = new cdk.CfnParameter(this, 'ClientInstanceType', {
            type: 'String',
            default: 't3.small',
            allowedPattern: '.+',
            constraintDescription: 'Client instance type must not be empty'
        });

        const clientAmiId = new cdk.CfnParameter(this, 'ClientAmiId', {
            type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
            default: '/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'
        });

        const ec2Client = new KafkaClient(this, 'EC2', {
            vpcId: brokerVpc.valueAsString,
            subnetId: cdk.Fn.select(0, brokerSubnets.valueAsList),
            imageId: clientAmiId.valueAsString,
            instanceType: clientInstanceType.valueAsString,

            kafkaVersion: kafkaVersion.valueAsString,
            clusterName: cluster.ClusterName,
            clusterSecurityGroupId: cluster.SecurityGroupId
        });

        //---------------------------------------------------------------------
        // Solution metrics
        new SolutionHelper(this, 'SolutionHelper', {
            solutionId: props.solutionId,
            pattern: MskStandalone.name,

            numberOfBrokerNodes: brokerNodes.valueAsNumber,
            brokerInstanceType: brokerInstanceType.valueAsString,
            monitoringLevel: monitoringLevel.valueAsString,
            accessControlMethod: accessControl.valueAsString
        });

        //---------------------------------------------------------------------
        // Monitoring (dashboard) configuration
        const dashboardName = cdk.Fn.join('-', ['MSK1', 'Monitoring', cdk.Aws.REGION]);

        new KafkaMonitoring(this, 'Monitoring', {
            clusterArn: cluster.ClusterArn,
            dashboardName: dashboardName
        });

        //---------------------------------------------------------------------
        // Template metadata
        this.templateOptions.metadata = {
            'AWS::CloudFormation::Interface': {
                ParameterGroups: [
                    {
                        Label: { default: 'Broker configuration' },
                        Parameters: [
                            kafkaVersion.logicalId,
                            brokerNodes.logicalId,
                            brokerInstanceType.logicalId,
                            monitoringLevel.logicalId,
                            ebsVolumeSize.logicalId
                        ]
                    },
                    {
                        Label: { default: 'Access control configuration' },
                        Parameters: [accessControl.logicalId]
                    },
                    {
                        Label: { default: 'Networking configuration' },
                        Parameters: [brokerVpc.logicalId, brokerSubnets.logicalId]
                    },
                    {
                        Label: { default: 'Client configuration' },
                        Parameters: [clientInstanceType.logicalId, clientAmiId.logicalId]
                    }
                ],
                ParameterLabels: {
                    [kafkaVersion.logicalId]: {
                        default: 'Apache Kafka version on the brokers'
                    },
                    [brokerInstanceType.logicalId]: {
                        default: 'EC2 instance type that Amazon MSK uses when it creates your brokers'
                    },
                    [brokerNodes.logicalId]: {
                        default: 'Number of broker nodes you want in the cluster (must be a multiple of the number of subnets)'
                    },
                    [monitoringLevel.logicalId]: {
                        default: 'Level of monitoring for the cluster'
                    },
                    [ebsVolumeSize.logicalId]: {
                        default: 'EBS storage volume per broker (in GiB)'
                    },

                    [accessControl.logicalId]: {
                        default: 'Method Amazon MSK uses to authenticate clients and allow or deny actions'
                    },

                    [brokerVpc.logicalId]: {
                        default: 'VPC where the cluster should be launched'
                    },
                    [brokerSubnets.logicalId]: {
                        default: 'List of subnets in which brokers are distributed (must contain between 2 and 3 items)'
                    },

                    [clientInstanceType.logicalId]: {
                        default: 'Instance type for the EC2 instance'
                    },
                    [clientAmiId.logicalId]: {
                        default: 'Amazon Machine Image for the EC2 instance'
                    }
                }
            }
        };

        //---------------------------------------------------------------------
        // Stack outputs
        new cdk.CfnOutput(this, 'MskClusterArn', {
            description: 'ARN of the Amazon MSK cluster',
            value: cluster.ClusterArn
        });

        new cdk.CfnOutput(this, 'ClientInstanceId', {
            description: 'ID of the client Amazon EC2 instance',
            value: ec2Client.InstanceId
        });

        new cdk.CfnOutput(this, 'CloudWatchDashboardName', {
            description: 'Name of the Amazon CloudWatch dashboard',
            value: dashboardName
        });
    }
}
