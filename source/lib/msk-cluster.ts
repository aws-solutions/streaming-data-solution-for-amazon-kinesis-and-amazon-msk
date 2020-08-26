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
import * as msk from '@aws-cdk/aws-msk';
import * as logs from '@aws-cdk/aws-logs';

export enum BrokerInstanceType {
    m5_large = 'kafka.m5.large',
    m5_xlarge = 'kafka.m5.xlarge',
    m5_2xlarge = 'kafka.m5.2xlarge',
    m5_4xlarge = 'kafka.m5.4xlarge',
    m5_8xlarge = 'kafka.m5.8xlarge',
    m5_12xlarge = 'kafka.m5.12xlarge',
    m5_16xlarge = 'kafka.m5.16xlarge',
    m5_24xlarge = 'kafka.m5.24xlarge',
    t3_small = 'kafka.t3.small'
}

export interface KafkaClusterProps {
    readonly kafkaVersion: '1.1.1' | '2.2.1' | '2.3.1' | '2.4.1';
    readonly numberOfBrokerNodes: number;
    readonly brokerInstanceType: BrokerInstanceType;

    readonly monitoringLevel: 'DEFAULT' | 'PER_BROKER' | 'PER_TOPIC_PER_BROKER';
    readonly logsRetentionDays: logs.RetentionDays;

    readonly brokerSubnets: string[];
    readonly securityGroups?: string[];
}

export class KafkaCluster extends cdk.Construct {
    private readonly Cluster: msk.CfnCluster;

    public get ClusterArn() {
        return this.Cluster.ref;
    }

    private MIN_SUBNETS: number = 2;
    private MAX_SUBNETS: number = 3;

    constructor(scope: cdk.Construct, id: string, props: KafkaClusterProps) {
        super(scope, id);

        if (props.brokerSubnets.length < this.MIN_SUBNETS || props.brokerSubnets.length > this.MAX_SUBNETS) {
            throw new Error(`brokerSubnets must contain between ${this.MIN_SUBNETS} and ${this.MAX_SUBNETS} items`);
        }

        if (props.numberOfBrokerNodes <= 0) {
            throw new Error('numberOfBrokerNodes must be a positive number');
        }

        if (props.numberOfBrokerNodes % props.brokerSubnets.length !== 0) {
            throw new Error('numberOfBrokerNodes must be a multiple of brokerSubnets');
        }

        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            retention: props.logsRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        this.Cluster = new msk.CfnCluster(this, 'KafkaCluster', {
            clusterName: `${cdk.Aws.STACK_NAME}-kafka-cluster`,
            kafkaVersion: props.kafkaVersion,
            numberOfBrokerNodes: props.numberOfBrokerNodes,
            brokerNodeGroupInfo: {
                brokerAzDistribution: 'DEFAULT',
                instanceType: props.brokerInstanceType,
                clientSubnets: props.brokerSubnets,
                securityGroups: props.securityGroups
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
}