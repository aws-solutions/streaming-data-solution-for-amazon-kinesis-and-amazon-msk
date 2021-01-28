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
import * as msk from '@aws-cdk/aws-msk';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as logs from '@aws-cdk/aws-logs';

export interface KafkaClusterProps {
    readonly kafkaVersion: string;
    readonly numberOfBrokerNodes: number;
    readonly brokerInstanceType: string;
    readonly monitoringLevel: string;

    readonly brokerVpcId: string;
    readonly brokerSubnets: string[];
}

export class KafkaCluster extends cdk.Construct {
    private readonly Cluster: msk.CfnCluster;
    private readonly SecurityGroup: ec2.CfnSecurityGroup;

    public get ClusterArn(): string {
        return this.Cluster.ref;
    }

    public get ClusterName(): string {
        return cdk.Fn.join('-', ['kafka-cluster', cdk.Aws.ACCOUNT_ID]);
    }

    public get SecurityGroupId(): string {
        return this.SecurityGroup.ref;
    }

    private MIN_SUBNETS: number = 2;
    private MAX_SUBNETS: number = 3;

    public static get AllowedKafkaVersions(): string[] {
        return ['2.7.0', '2.6.1', '2.6.0', '2.5.1', '2.4.1.1', '2.3.1', '2.2.1'];
    }

    public static get AllowedInstanceTypes(): string[] {
        return ['kafka.m5.large', 'kafka.m5.xlarge', 'kafka.m5.2xlarge', 'kafka.m5.4xlarge', 'kafka.m5.8xlarge', 'kafka.m5.12xlarge', 'kafka.m5.16xlarge', 'kafka.m5.24xlarge', 'kafka.t3.small'];
    }

    public static get AllowedMonitoringLevels(): string[] {
        return ['DEFAULT', 'PER_BROKER', 'PER_TOPIC_PER_BROKER'];
    }

    public static get RequiredRules() {
        return [
            { port: 2181, description: 'ZooKeeper Plaintext' },
            { port: 2182, description: 'ZooKeeper TLS' },
            { port: 9092, description: 'Bootstrap servers Plaintext' },
            { port: 9094, description: 'Bootstrap servers TLS' },
        ];
    }

    constructor(scope: cdk.Construct, id: string, props: KafkaClusterProps) {
        super(scope, id);

        if (!cdk.Token.isUnresolved(props.kafkaVersion) && !KafkaCluster.AllowedKafkaVersions.includes(props.kafkaVersion)) {
            throw new Error(`Unknown Kafka version: ${props.kafkaVersion}`);
        }

        if (!cdk.Token.isUnresolved(props.brokerInstanceType) && !KafkaCluster.AllowedInstanceTypes.includes(props.brokerInstanceType)) {
            throw new Error(`Unknown instance type: ${props.brokerInstanceType}`);
        }

        if (!cdk.Token.isUnresolved(props.monitoringLevel) && !KafkaCluster.AllowedMonitoringLevels.includes(props.monitoringLevel)) {
            throw new Error(`Unknown monitoring level: ${props.monitoringLevel}`);
        }

        if (!cdk.Token.isUnresolved(props.brokerSubnets)) {
            if (props.brokerSubnets.length < this.MIN_SUBNETS || props.brokerSubnets.length > this.MAX_SUBNETS) {
                throw new Error(`brokerSubnets must contain between ${this.MIN_SUBNETS} and ${this.MAX_SUBNETS} items`);
            }
        }

        if (!cdk.Token.isUnresolved(props.numberOfBrokerNodes) && props.numberOfBrokerNodes <= 0) {
            throw new Error('numberOfBrokerNodes must be a positive number');
        }

        if (!cdk.Token.isUnresolved(props.brokerSubnets) && !cdk.Token.isUnresolved(props.numberOfBrokerNodes)) {
            if (props.numberOfBrokerNodes % props.brokerSubnets.length !== 0) {
                throw new Error('numberOfBrokerNodes must be a multiple of brokerSubnets');
            }
        }

        this.SecurityGroup = this.createSecurityGroup(props.brokerVpcId);

        const logGroup = new logs.LogGroup(this, 'LogGroup', { removalPolicy: cdk.RemovalPolicy.RETAIN });
        (logGroup.node.defaultChild as logs.CfnLogGroup).cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W84',
                    reason: 'Log group data is always encrypted in CloudWatch Logs using an AWS Managed KMS Key'
                }]
            }
        };

        this.Cluster = new msk.CfnCluster(this, 'KafkaCluster', {
            clusterName: this.ClusterName,
            kafkaVersion: props.kafkaVersion,
            numberOfBrokerNodes: props.numberOfBrokerNodes,
            brokerNodeGroupInfo: {
                brokerAzDistribution: 'DEFAULT',
                instanceType: props.brokerInstanceType,
                clientSubnets: props.brokerSubnets,
                securityGroups: [this.SecurityGroupId]
            },
            loggingInfo: {
                brokerLogs: {
                    cloudWatchLogs: {
                        logGroup: logGroup.logGroupName,
                        enabled: true
                    }
                }
            },
            enhancedMonitoring: props.monitoringLevel,
            encryptionInfo: {
                encryptionAtRest: {
                    dataVolumeKmsKeyId: 'alias/aws/kafka'
                },
                encryptionInTransit: {
                    clientBroker: 'TLS',
                    inCluster: true
                }
            },
            openMonitoring: {
                prometheus: {
                    jmxExporter: { enabledInBroker: true },
                    nodeExporter: { enabledInBroker: true }
                }
            }
        });
    }

    private createSecurityGroup(vpcId: string): ec2.CfnSecurityGroup {
        const securityGroup = new ec2.CfnSecurityGroup(this, 'ClusterSG', {
            vpcId: vpcId,
            groupDescription: 'Security group for the MSK cluster',
            tags: [{ key: 'Name', value: 'msk-cluster-sg' }]
        });

        securityGroup.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'F1000',
                    reason: 'No egress rule defined as default (all traffic allowed outbound) is sufficient for this resource'
                }]
            }
        };

        KafkaCluster.RequiredRules.forEach((rule, index) => {
            new ec2.CfnSecurityGroupIngress(this, `IngressRule${index}`, {
                ipProtocol: 'tcp',
                groupId: securityGroup.ref,
                sourceSecurityGroupId: securityGroup.ref,
                fromPort: rule.port,
                toPort: rule.port,
                description: rule.description
            });
        });

        return securityGroup;
    }
}
